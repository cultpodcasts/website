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

@Component({
  selector: 'app-title-casing-rules',
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTabsModule,
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
  languageOptions = signal<LanguageOption[]>([]);
  selectedLanguage = signal('');
  currentRules = signal<LanguageTitleCasingRules | undefined>(undefined);
  newLowerCaseTerm = '';
  editingLowerCaseIndex = signal<number | null>(null);
  editingLowerCaseValue = '';
  lowerCaseFilter = signal('');
  knownTermFilter = signal('');

  readonly canSave = computed(() =>
    !this.isLoading() && !this.isSaving() && !!this.selectedLanguage() && !!this.currentRules()
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
    private dialogRef: MatDialogRef<TitleCasingRulesComponent, { saved?: boolean }>
  ) { }

  async ngOnInit() {
    await this.load();
  }

  close() {
    this.dialogRef.close({ saved: false });
  }

  async onLanguageChange(code: string) {
    if (code === this.selectedLanguage() && this.currentRules()) {
      return;
    }

    this.selectedLanguage.set(code);
    this.cancelEditLowerCaseTerm();
    this.newLowerCaseTerm = '';
    this.lowerCaseFilter.set('');
    this.knownTermFilter.set('');
    this.currentRules.set(undefined);
    this.isDefault.set(false);
    this.isLoading.set(true);
    try {
      await this.loadLanguageRules(code);
    } finally {
      this.isLoading.set(false);
    }
  }

  addLowerCaseTerm() {
    const term = this.newLowerCaseTerm.trim();
    const rules = this.currentRules();
    if (!term || !rules) {
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
    if (!rules) {
      return;
    }
    this.editingLowerCaseIndex.set(index);
    this.editingLowerCaseValue = rules.lowerCaseTerms[index];
  }

  saveEditLowerCaseTerm() {
    const index = this.editingLowerCaseIndex();
    const rules = this.currentRules();
    if (index == null || !rules) {
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
    if (!rules) {
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

  async onSave() {
    if (!this.canSave()) {
      return;
    }

    const lang = this.selectedLanguage();
    const rules = this.currentRules();
    if (!lang || !rules) {
      return;
    }

    this.isSaving.set(true);
    this.isInError.set(false);
    this.errorMessage.set('');

    const body: LanguageTitleCasingRulesUpdate = {
      lowerCaseTerms: rules.lowerCaseTerms,
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

      const resp = await firstValueFrom(
        this.http.put<LanguageTitleCasingRulesResponse>(
          new URL(`/title-casing-rules/${encodeURIComponent(lang)}`, environment.api).toString(),
          body,
          { headers, observe: 'response' }
        )
      );

      if (resp.status === 200 && resp.body) {
        this.applyLanguageRules(resp.body);
        this.isSaving.set(false);
        this.dialogRef.close({ saved: true });
        return;
      }

      this.isInError.set(true);
      this.errorMessage.set('Save failed.');
      this.isSaving.set(false);
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

      // Prefer English; only fetch terms for the selected language (not every option).
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

      const resp = await firstValueFrom(
        this.http.get<LanguageTitleCasingRulesResponse>(
          new URL(`/title-casing-rules/${encodeURIComponent(code)}`, environment.api).toString(),
          { headers: authHeaders, observe: 'response' }
        )
      );

      if (resp.status === 200 && resp.body) {
        this.applyLanguageRules(resp.body);
        return;
      }

      if (resp.status === 404) {
        this.isDefault.set(false);
        this.currentRules.set({ lowerCaseTerms: [], knownTerms: [] });
        return;
      }

      this.isInError.set(true);
      this.errorMessage.set('Failed to load title casing rules.');
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

  private applyLanguageRules(rules: LanguageTitleCasingRulesResponse) {
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
          scope: 'admin'
        }
      }));
      if (!token) {
        return undefined;
      }
      return new HttpHeaders().set('Authorization', 'Bearer ' + token);
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }
}
