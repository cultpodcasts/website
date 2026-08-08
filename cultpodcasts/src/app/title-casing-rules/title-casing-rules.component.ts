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
  LanguageTitleCasingRulesResponse
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
  isMutating = signal(false);
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
  private didMutate = false;

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
    this.dialogRef.close({ saved: this.didMutate });
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

  async addLowerCaseTerm() {
    const term = this.newLowerCaseTerm.trim();
    const lang = this.activeLanguage();
    if (!term || !lang || this.isUniversalMode() || this.isMutating()) {
      return;
    }

    const rules = this.currentRules();
    if (rules?.lowerCaseTerms.some(t => t.toLowerCase() === term.toLowerCase())) {
      return;
    }

    await this.mutate(async headers => {
      const resp = await firstValueFrom(
        this.http.post<LanguageTitleCasingRulesResponse>(
          this.lowerCaseTermsUrl(lang),
          { term },
          { headers, observe: 'response' }
        )
      );
      if (resp.status === 200 && resp.body) {
        this.applyLanguageRules(resp.body);
        this.newLowerCaseTerm = '';
        this.lowerCaseFilter.set('');
        return;
      }
      throw Object.assign(new Error('Add failed.'), { error: { error: 'Add failed.' } });
    });
  }

  startEditLowerCaseTerm(index: number) {
    const rules = this.currentRules();
    if (!rules || this.isUniversalMode() || this.isMutating()) {
      return;
    }
    this.editingLowerCaseIndex.set(index);
    this.editingLowerCaseValue = rules.lowerCaseTerms[index];
  }

  async saveEditLowerCaseTerm() {
    const index = this.editingLowerCaseIndex();
    const rules = this.currentRules();
    const lang = this.activeLanguage();
    if (index == null || !rules || !lang || this.isUniversalMode() || this.isMutating()) {
      return;
    }
    const oldTerm = rules.lowerCaseTerms[index];
    const term = this.editingLowerCaseValue.trim();
    if (!term) {
      return;
    }
    if (term.toLowerCase() === oldTerm.toLowerCase()) {
      this.cancelEditLowerCaseTerm();
      return;
    }

    await this.mutate(async headers => {
      await firstValueFrom(
        this.http.delete<LanguageTitleCasingRulesResponse>(
          this.lowerCaseTermUrl(lang, oldTerm),
          { headers, observe: 'response' }
        )
      );
      const resp = await firstValueFrom(
        this.http.post<LanguageTitleCasingRulesResponse>(
          this.lowerCaseTermsUrl(lang),
          { term },
          { headers, observe: 'response' }
        )
      );
      if (resp.status === 200 && resp.body) {
        this.applyLanguageRules(resp.body);
        this.cancelEditLowerCaseTerm();
        return;
      }
      throw Object.assign(new Error('Edit failed.'), { error: { error: 'Edit failed.' } });
    }, async () => {
      try {
        await this.loadLanguageRules(lang);
      } catch {
        // keep mutation error
      }
    });
  }

  cancelEditLowerCaseTerm() {
    this.editingLowerCaseIndex.set(null);
    this.editingLowerCaseValue = '';
  }

  async deleteLowerCaseTerm(index: number) {
    const rules = this.currentRules();
    const lang = this.activeLanguage();
    if (!rules || !lang || this.isUniversalMode() || this.isMutating()) {
      return;
    }
    const term = rules.lowerCaseTerms[index];
    if (!term) {
      return;
    }

    await this.mutate(async headers => {
      const resp = await firstValueFrom(
        this.http.delete<LanguageTitleCasingRulesResponse>(
          this.lowerCaseTermUrl(lang, term),
          { headers, observe: 'response' }
        )
      );
      if (resp.status === 200 && resp.body) {
        this.applyLanguageRules(resp.body);
        this.cancelEditLowerCaseTerm();
        return;
      }
      throw Object.assign(new Error('Delete failed.'), { error: { error: 'Delete failed.' } });
    });
  }

  openKnownTermDialog(index?: number) {
    const rules = this.currentRules();
    if (!rules || this.isMutating()) {
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
      void this.saveKnownTerm(result.term, index == null ? undefined : rules.knownTerms[index]);
    });
  }

  async deleteKnownTerm(index: number) {
    const rules = this.currentRules();
    const lang = this.activeLanguage();
    if (!rules || !lang || this.isMutating()) {
      return;
    }
    const term = rules.knownTerms[index];
    if (!term) {
      return;
    }

    await this.mutate(async headers => {
      const resp = await firstValueFrom(
        this.http.delete<LanguageTitleCasingRulesResponse>(
          this.knownTermUrl(lang, term.literal),
          { headers, observe: 'response' }
        )
      );
      if (resp.status === 200 && resp.body) {
        this.applyLanguageRules(resp.body);
        return;
      }
      throw Object.assign(new Error('Delete failed.'), { error: { error: 'Delete failed.' } });
    });
  }

  async promoteKnownTerm(index: number) {
    const rules = this.currentRules();
    if (!rules || !this.showPromote() || this.isMutating()) {
      return;
    }

    const term = rules.knownTerms[index];
    if (!term) {
      return;
    }

    if (!window.confirm(`Move “${term.literal}” to Universal and remove it from English?`)) {
      return;
    }

    await this.mutate(async headers => {
      const universal = await this.fetchRules(UNIVERSAL_LANGUAGE, headers);
      if (universal.knownTerms.some(t => t.literal.toLowerCase() === term.literal.toLowerCase())) {
        this.snackBar.open('That known term is already in Universal.', 'Dismiss', { duration: 4000 });
        return;
      }

      await firstValueFrom(
        this.http.post<LanguageTitleCasingRulesResponse>(
          this.knownTermsUrl(UNIVERSAL_LANGUAGE),
          term,
          { headers, observe: 'response' }
        )
      );
      const englishResp = await firstValueFrom(
        this.http.delete<LanguageTitleCasingRulesResponse>(
          this.knownTermUrl('en', term.literal),
          { headers, observe: 'response' }
        )
      );
      if (englishResp.status === 200 && englishResp.body) {
        this.applyLanguageRules(englishResp.body);
        this.snackBar.open(`Promoted “${term.literal}” to Universal.`, 'Dismiss', { duration: 3000 });
        return;
      }
      throw Object.assign(new Error('Promote failed.'), { error: { error: 'Promote failed.' } });
    }, async () => {
      try {
        await this.loadLanguageRules('en');
      } catch {
        // keep promote error
      }
    });
  }

  private async saveKnownTerm(term: KnownTerm, previous?: KnownTerm) {
    const lang = this.activeLanguage();
    if (!lang || this.isMutating()) {
      return;
    }

    await this.mutate(async headers => {
      if (previous
        && previous.literal.toLowerCase() !== term.literal.toLowerCase()) {
        await firstValueFrom(
          this.http.delete<LanguageTitleCasingRulesResponse>(
            this.knownTermUrl(lang, previous.literal),
            { headers, observe: 'response' }
          )
        );
      }

      const resp = await firstValueFrom(
        this.http.post<LanguageTitleCasingRulesResponse>(
          this.knownTermsUrl(lang),
          term,
          { headers, observe: 'response' }
        )
      );
      if (resp.status === 200 && resp.body) {
        this.applyLanguageRules(resp.body);
        if (!previous) {
          this.knownTermFilter.set('');
        }
        return;
      }
      throw Object.assign(new Error('Save known term failed.'), { error: { error: 'Save known term failed.' } });
    }, async () => {
      try {
        await this.loadLanguageRules(lang);
      } catch {
        // keep mutation error
      }
    });
  }

  private async mutate(
    action: (headers: HttpHeaders) => Promise<void>,
    onError?: () => Promise<void>
  ) {
    this.isMutating.set(true);
    this.isInError.set(false);
    this.errorMessage.set('');

    try {
      const headers = await this.authHeaders();
      if (!headers) {
        this.isInError.set(true);
        this.errorMessage.set('Could not get admin token.');
        return;
      }

      await action(headers);
      this.didMutate = true;
    } catch (error: any) {
      console.error(error);
      this.isInError.set(true);
      this.errorMessage.set(error?.error?.error ?? 'Update failed.');
      if (onError) {
        await onError();
      }
    } finally {
      this.isMutating.set(false);
    }
  }

  private activeLanguage(): string {
    return this.isUniversalMode() ? UNIVERSAL_LANGUAGE : this.selectedLanguage();
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
    try {
      const resp = await firstValueFrom(
        this.http.get<LanguageTitleCasingRulesResponse>(
          this.rulesUrl(code),
          { headers, observe: 'response' }
        )
      );

      if (resp.status === 200 && resp.body) {
        return {
          lowerCaseTerms: [...(resp.body.lowerCaseTerms ?? [])],
          knownTerms: (resp.body.knownTerms ?? []).map(t => ({ ...t })),
          isDefault: resp.body.isDefault
        };
      }

      if (resp.status === 404) {
        return { lowerCaseTerms: [], knownTerms: [], isDefault: false };
      }

      throw new Error('Failed to load title casing rules.');
    } catch (error: any) {
      if (error?.status === 404) {
        return { lowerCaseTerms: [], knownTerms: [], isDefault: false };
      }
      throw error;
    }
  }

  private rulesUrl(code: string): string {
    return new URL(
      `/title-casing-rules/${encodeURIComponent(code)}`,
      environment.api
    ).toString();
  }

  private lowerCaseTermsUrl(code: string): string {
    return new URL(
      `/title-casing-rules/${encodeURIComponent(code)}/lower-case-terms`,
      environment.api
    ).toString();
  }

  private lowerCaseTermUrl(code: string, term: string): string {
    return new URL(
      `/title-casing-rules/${encodeURIComponent(code)}/lower-case-terms/${encodeURIComponent(term)}`,
      environment.api
    ).toString();
  }

  private knownTermsUrl(code: string): string {
    return new URL(
      `/title-casing-rules/${encodeURIComponent(code)}/known-terms`,
      environment.api
    ).toString();
  }

  private knownTermUrl(code: string, literal: string): string {
    return new URL(
      `/title-casing-rules/${encodeURIComponent(code)}/known-terms/${encodeURIComponent(literal)}`,
      environment.api
    ).toString();
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
          scope: 'admin'
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
