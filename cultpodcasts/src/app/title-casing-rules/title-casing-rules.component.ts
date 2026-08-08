import { NgTemplateOutlet } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import {
  KnownTermDialogComponent,
  KnownTermDialogData,
  KnownTermDialogResult
} from './known-term-dialog.component';
import {
  KnownTerm,
  LanguageTitleCasingRules,
  LanguageTitleCasingRulesResponse,
  LanguageTitleCasingRulesUpdate
} from './title-casing-rules.interface';

interface LanguageOption {
  code: string;
  name: string;
}

const UNIVERSAL_LANGUAGE = '*';

@Component({
  selector: 'app-title-casing-rules',
  imports: [
    NgTemplateOutlet,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTabsModule,
    MatSnackBarModule,
    FormsModule
  ],
  templateUrl: './title-casing-rules.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './title-casing-rules.component.sass'
})
export class TitleCasingRulesComponent {
  isLoading = signal(true);
  isSaving = signal(false);
  isInError = signal(false);
  errorMessage = signal('');
  isDefault = signal(false);
  isUniversalMode = signal(false);
  languageOptions = signal<LanguageOption[]>([]);
  selectedLanguage = signal('');
  currentRules = signal<LanguageTitleCasingRules | undefined>(undefined);
  newLowerCaseTerm = '';
  editingLowerCaseIndex = signal<number | null>(null);
  editingLowerCaseValue = '';
  lowerCaseFilter = signal('');
  knownTermFilter = signal('');
  /** In-session Universal known-terms after promote/save — avoids lost updates if GET is stale. */
  private universalKnownTermsCache: KnownTerm[] | null = null;

  readonly canSave = computed(() =>
    !this.isLoading()
    && !this.isSaving()
    && !!this.currentRules()
    && (this.isUniversalMode() || !!this.selectedLanguage())
  );

  readonly showPromote = computed(() =>
    !this.isUniversalMode() && this.selectedLanguage() === 'en'
  );

  readonly filteredLowerCaseTerms = computed(() => {
    const rules = this.currentRules();
    if (!rules) {
      return [] as { term: string; index: number }[];
    }
    const q = this.lowerCaseFilter().trim().toLowerCase();
    return rules.lowerCaseTerms
      .map((term, index) => ({ term, index }))
      .filter(item => !q || item.term.toLowerCase().includes(q));
  });

  readonly filteredKnownTerms = computed(() => {
    const rules = this.currentRules();
    if (!rules) {
      return [] as { term: KnownTerm; index: number }[];
    }
    const q = this.knownTermFilter().trim().toLowerCase();
    return rules.knownTerms
      .map((term, index) => ({ term, index }))
      .filter(item =>
        !q
        || item.term.literal.toLowerCase().includes(q)
        || item.term.pattern.toLowerCase().includes(q)
      );
  });

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<TitleCasingRulesComponent, { saved?: boolean }>
  ) { }

  async ngOnInit() {
    await this.load();
  }

  close() {
    this.dialogRef.close({ saved: false });
  }

  async onLanguageChange(code: string) {
    if (!this.isUniversalMode() && code === this.selectedLanguage() && this.currentRules()) {
      return;
    }

    this.isUniversalMode.set(false);
    this.selectedLanguage.set(code);
    this.cancelEditLowerCaseTerm();
    this.newLowerCaseTerm = '';
    this.lowerCaseFilter.set('');
    this.knownTermFilter.set('');
    this.isDefault.set(false);
    this.isLoading.set(true);
    try {
      await this.loadLanguageRules(code);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onUniversalClick() {
    this.cancelEditLowerCaseTerm();
    this.newLowerCaseTerm = '';
    this.lowerCaseFilter.set('');
    this.knownTermFilter.set('');
    this.isDefault.set(false);
    this.isLoading.set(true);
    try {
      if (this.isUniversalMode()) {
        // Toggle off — restore the language still shown in the dropdown.
        this.isUniversalMode.set(false);
        const lang = this.selectedLanguage();
        if (lang) {
          await this.loadLanguageRules(lang);
        } else {
          this.currentRules.set(undefined);
        }
        return;
      }

      this.isUniversalMode.set(true);
      await this.loadLanguageRules(UNIVERSAL_LANGUAGE);
    } finally {
      this.isLoading.set(false);
    }
  }

  addLowerCaseTerm() {
    const term = this.newLowerCaseTerm.trim();
    const rules = this.currentRules();
    if (!term || !rules || this.isUniversalMode()) {
      return;
    }
    if (rules.lowerCaseTerms.some(t => t.toLowerCase() === term.toLowerCase())) {
      return;
    }
    this.currentRules.set({
      ...rules,
      lowerCaseTerms: [...rules.lowerCaseTerms, term].sort((a, b) => a.localeCompare(b))
    });
    this.newLowerCaseTerm = '';
    this.lowerCaseFilter.set('');
  }

  startEditLowerCaseTerm(index: number) {
    const rules = this.currentRules();
    if (!rules || this.isUniversalMode()) {
      return;
    }
    this.editingLowerCaseIndex.set(index);
    this.editingLowerCaseValue = rules.lowerCaseTerms[index];
  }

  saveEditLowerCaseTerm() {
    const index = this.editingLowerCaseIndex();
    const rules = this.currentRules();
    if (index == null || !rules || this.isUniversalMode()) {
      return;
    }
    const term = this.editingLowerCaseValue.trim();
    if (!term) {
      return;
    }
    const next = [...rules.lowerCaseTerms];
    next[index] = term;
    this.currentRules.set({
      ...rules,
      lowerCaseTerms: next.sort((a, b) => a.localeCompare(b))
    });
    this.cancelEditLowerCaseTerm();
  }

  cancelEditLowerCaseTerm() {
    this.editingLowerCaseIndex.set(null);
    this.editingLowerCaseValue = '';
  }

  deleteLowerCaseTerm(index: number) {
    const rules = this.currentRules();
    if (!rules || this.isUniversalMode()) {
      return;
    }
    this.currentRules.set({
      ...rules,
      lowerCaseTerms: rules.lowerCaseTerms.filter((_, i) => i !== index)
    });
    this.cancelEditLowerCaseTerm();
  }

  openKnownTermDialog(index?: number) {
    const rules = this.currentRules();
    if (!rules) {
      return;
    }
    const data: KnownTermDialogData = index == null
      ? {}
      : { term: rules.knownTerms[index] };
    this.dialog.open<KnownTermDialogComponent, KnownTermDialogData, KnownTermDialogResult>(
      KnownTermDialogComponent,
      { data, autoFocus: true, width: '24em', maxWidth: '95vw' }
    ).afterClosed().subscribe(result => {
      if (!result?.term) {
        return;
      }
      const current = this.currentRules();
      if (!current) {
        return;
      }
      const knownTerms = [...current.knownTerms];
      if (index == null) {
        knownTerms.push(result.term);
        this.knownTermFilter.set('');
      } else {
        knownTerms[index] = result.term;
      }
      this.currentRules.set({ ...current, knownTerms });
    });
  }

  deleteKnownTerm(index: number) {
    const rules = this.currentRules();
    if (!rules) {
      return;
    }
    this.currentRules.set({
      ...rules,
      knownTerms: rules.knownTerms.filter((_, i) => i !== index)
    });
  }

  async promoteKnownTerm(index: number) {
    const rules = this.currentRules();
    if (!rules || !this.showPromote()) {
      return;
    }

    const term = rules.knownTerms[index];
    if (!term) {
      return;
    }

    if (!window.confirm(`Move “${term.literal}” to Universal and remove it from English?`)) {
      return;
    }

    this.isSaving.set(true);
    this.isInError.set(false);
    this.errorMessage.set('');

    try {
      const headers = await this.authHeaders();
      if (!headers) {
        this.isInError.set(true);
        this.errorMessage.set('Could not get admin token.');
        this.isSaving.set(false);
        return;
      }

      const universal = await this.fetchRules(UNIVERSAL_LANGUAGE, headers);
      const universalTerms = this.universalKnownTermsCache ?? universal.knownTerms;
      if (universalTerms.some(t => t.literal === term.literal)) {
        this.snackBar.open('That known term is already in Universal.', 'Dismiss', { duration: 4000 });
        this.isSaving.set(false);
        return;
      }

      const nextUniversalTerms = [...universalTerms, { ...term }];
      const nextUniversal: LanguageTitleCasingRulesUpdate = {
        lowerCaseTerms: [],
        knownTerms: nextUniversalTerms
      };
      await this.putRules(UNIVERSAL_LANGUAGE, nextUniversal, headers);
      this.universalKnownTermsCache = nextUniversalTerms.map(t => ({ ...t }));

      const nextEnglish: LanguageTitleCasingRulesUpdate = {
        lowerCaseTerms: rules.lowerCaseTerms,
        knownTerms: rules.knownTerms.filter((_, i) => i !== index)
      };
      const englishResp = await this.putRules('en', nextEnglish, headers);
      this.applyLanguageRules(englishResp);
      this.snackBar.open(`Promoted “${term.literal}” to Universal.`, 'Dismiss', { duration: 3000 });
    } catch (error: any) {
      console.error(error);
      this.isInError.set(true);
      this.errorMessage.set(error?.error?.error ?? 'Promote failed.');
      try {
        await this.loadLanguageRules('en');
      } catch {
        // keep error from promote
      }
    } finally {
      this.isSaving.set(false);
    }
  }

  async onSave() {
    if (!this.canSave()) {
      return;
    }

    const lang = this.isUniversalMode() ? UNIVERSAL_LANGUAGE : this.selectedLanguage();
    const rules = this.currentRules();
    if (!lang || !rules) {
      return;
    }

    this.isSaving.set(true);
    this.isInError.set(false);
    this.errorMessage.set('');

    const body: LanguageTitleCasingRulesUpdate = {
      lowerCaseTerms: this.isUniversalMode() ? [] : rules.lowerCaseTerms,
      knownTerms: rules.knownTerms
    };

    try {
      const headers = await this.authHeaders();
      if (!headers) {
        this.isInError.set(true);
        this.errorMessage.set('Could not get admin token.');
        this.isSaving.set(false);
        return;
      }

      const respBody = await this.putRules(lang, body, headers);
      if (lang === UNIVERSAL_LANGUAGE) {
        this.universalKnownTermsCache = body.knownTerms.map(t => ({ ...t }));
      }
      this.applyLanguageRules(respBody);
      this.isSaving.set(false);
      this.dialogRef.close({ saved: true });
    } catch (error: any) {
      console.error(error);
      this.isInError.set(true);
      this.errorMessage.set(error?.error?.error ?? 'Save failed.');
      this.isSaving.set(false);
    }
  }

  private async load() {
    this.isLoading.set(true);
    this.isInError.set(false);
    this.errorMessage.set('');

    try {
      const headers = await this.authHeaders();
      if (!headers) {
        this.isInError.set(true);
        this.errorMessage.set('Could not get admin token.');
        this.isLoading.set(false);
        return;
      }

      const languagesResp = await firstValueFrom(
        this.http.get<{ [key: string]: string }>(
          new URL('/languages', environment.api).toString(),
          { headers, observe: 'response' }
        )
      );

      if (languagesResp.status !== 200 || !languagesResp.body) {
        this.isInError.set(true);
        this.errorMessage.set('Failed to load languages.');
        this.isLoading.set(false);
        return;
      }

      const options = Object.entries(languagesResp.body)
        .map(([code, name]) => ({ code, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
      this.languageOptions.set(options);

      const initialLang =
        options.find(o => o.code === 'en')?.code
        ?? options[0]?.code
        ?? '';
      this.selectedLanguage.set(initialLang);
      if (initialLang) {
        await this.loadLanguageRules(initialLang, headers);
      }
    } catch (error) {
      console.error(error);
      this.isInError.set(true);
      this.errorMessage.set('Failed to load title casing rules.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadLanguageRules(code: string, headers?: HttpHeaders) {
    this.isInError.set(false);
    this.errorMessage.set('');
    try {
      const authHeaders = headers ?? await this.authHeaders();
      if (!authHeaders) {
        this.isInError.set(true);
        this.errorMessage.set('Could not get admin token.');
        return;
      }

      const rules = await this.fetchRules(code, authHeaders);
      this.applyLanguageRules({
        language: code,
        lowerCaseTerms: rules.lowerCaseTerms,
        knownTerms: rules.knownTerms,
        isDefault: rules.isDefault
      });
    } catch (error: any) {
      if (error?.status === 404) {
        this.isDefault.set(false);
        this.currentRules.set({ lowerCaseTerms: [], knownTerms: [] });
        return;
      }
      console.error(error);
      this.isInError.set(true);
      this.errorMessage.set('Failed to load title casing rules.');
    }
  }

  private async fetchRules(
    code: string,
    headers: HttpHeaders
  ): Promise<LanguageTitleCasingRules & { isDefault: boolean }> {
    // Do not send Cache-Control / Pragma / ngsw-bypass as request headers:
    // api-preview CORS only allows authorization + content-type, so extra
    // headers make the browser abort the GET after OPTIONS (looks like a 504).
    // Worker already returns Cache-Control: no-store; ngsw bypass is a query param.
    try {
      const resp = await firstValueFrom(
        this.http.get<LanguageTitleCasingRulesResponse>(
          this.rulesUrl(code),
          { headers, observe: 'response' }
        )
      );

      if (resp.status === 200 && resp.body) {
        const knownTerms = (resp.body.knownTerms ?? []).map(t => ({ ...t }));
        if (code === UNIVERSAL_LANGUAGE) {
          this.universalKnownTermsCache = knownTerms.map(t => ({ ...t }));
        }
        return {
          lowerCaseTerms: [...(resp.body.lowerCaseTerms ?? [])],
          knownTerms,
          isDefault: resp.body.isDefault
        };
      }

      if (resp.status === 404) {
        if (code === UNIVERSAL_LANGUAGE) {
          this.universalKnownTermsCache = [];
        }
        return { lowerCaseTerms: [], knownTerms: [], isDefault: false };
      }

      throw new Error('Failed to load title casing rules.');
    } catch (error: any) {
      if (error?.status === 404) {
        if (code === UNIVERSAL_LANGUAGE) {
          this.universalKnownTermsCache = [];
        }
        return { lowerCaseTerms: [], knownTerms: [], isDefault: false };
      }
      throw error;
    }
  }

  private async putRules(
    code: string,
    body: LanguageTitleCasingRulesUpdate,
    headers: HttpHeaders
  ): Promise<LanguageTitleCasingRulesResponse> {
    const resp = await firstValueFrom(
      this.http.put<LanguageTitleCasingRulesResponse>(
        this.rulesUrl(code),
        body,
        { headers, observe: 'response' }
      )
    );

    if (resp.status === 200 && resp.body) {
      return resp.body;
    }

    throw Object.assign(new Error('Save failed.'), { error: { error: 'Save failed.' } });
  }

  private rulesUrl(code: string): string {
    const url = new URL(
      `/title-casing-rules/${encodeURIComponent(code)}`,
      environment.api
    );
    // Query form avoids a custom header that CORS would reject.
    url.searchParams.set('ngsw-bypass', 'true');
    return url.toString();
  }

  private applyLanguageRules(rules: LanguageTitleCasingRulesResponse | (LanguageTitleCasingRules & { isDefault: boolean; language?: string })) {
    this.isDefault.set(rules.isDefault);
    this.currentRules.set({
      lowerCaseTerms: [...(rules.lowerCaseTerms ?? [])],
      knownTerms: (rules.knownTerms ?? []).map(t => ({ ...t }))
    });
  }

  private async authHeaders(): Promise<HttpHeaders | undefined> {
    try {
      const token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
        authorizationParams: {
          audience: `https://api.cultpodcasts.com/`,
          // Azure TitleCasingRules requires curate; Worker gate accepts admin.
          scope: 'admin curate'
        }
      }));
      if (!token) {
        return undefined;
      }
      return new HttpHeaders()
        .set('Authorization', 'Bearer ' + token);
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }
}
