import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { ConfirmComponent } from '../confirm/confirm.component';
import { Subject } from '../subject.interface';
import { LanguageTitleCasingRulesResponse } from '../title-casing-rules/title-casing-rules.interface';

interface LanguageOption {
  code: string;
  name: string;
}

@Component({
  selector: 'app-language-ignored-subjects',
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatAutocompleteModule,
    MatOptionModule,
    FormsModule
  ],
  templateUrl: './language-ignored-subjects.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './language-ignored-subjects.component.sass'
})
export class LanguageIgnoredSubjectsComponent {
  isLoading = signal(true);
  isMutating = signal(false);
  isInError = signal(false);
  errorMessage = signal('');
  addError = signal('');
  isDefault = signal(false);
  languageOptions = signal<LanguageOption[]>([]);
  selectedLanguage = signal('');
  ignoredSubjects = signal<string[]>([]);
  allSubjects = signal<string[]>([]);
  subjectFilter = signal('');
  newSubject = signal('');
  private didMutate = false;

  readonly filteredIgnoredSubjects = computed(() => {
    const q = this.subjectFilter().trim().toLowerCase();
    return this.ignoredSubjects()
      .map((term, index) => ({ term, index }))
      .filter(item => !q || item.term.toLowerCase().includes(q));
  });

  readonly pickerSubjects = computed(() => {
    const ignored = new Set(this.ignoredSubjects().map(s => s.toLowerCase()));
    const q = this.newSubject().trim().toLowerCase();
    return this.allSubjects()
      .filter(name => !ignored.has(name.toLowerCase()))
      .filter(name => !q || name.toLowerCase().includes(q));
  });

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialog: MatDialog,
    private dialogRef: MatDialogRef<LanguageIgnoredSubjectsComponent, { saved?: boolean }>
  ) { }

  async ngOnInit() {
    await this.load();
  }

  close() {
    this.dialogRef.close({ saved: this.didMutate });
  }

  async onLanguageChange(code: string) {
    if (code === this.selectedLanguage() && !this.isLoading()) {
      return;
    }

    this.selectedLanguage.set(code);
    this.subjectFilter.set('');
    this.newSubject.set('');
    this.addError.set('');
    this.isDefault.set(false);
    this.isLoading.set(true);
    try {
      await this.loadLanguageRules(code);
    } finally {
      this.isLoading.set(false);
    }
  }

  async addIgnoredSubject() {
    const term = this.newSubject().trim();
    const lang = this.selectedLanguage();
    if (!term || !lang || this.isMutating()) {
      return;
    }

    if (!this.allSubjects().some(s => s.toLowerCase() === term.toLowerCase())) {
      this.addError.set('Pick a subject from the list.');
      return;
    }

    if (this.ignoredSubjects().some(s => s.toLowerCase() === term.toLowerCase())) {
      return;
    }

    await this.mutate(async headers => {
      const resp = await firstValueFrom(
        this.http.post<LanguageTitleCasingRulesResponse>(
          this.ignoredSubjectsUrl(lang),
          { term },
          { headers, observe: 'response' }
        )
      );
      if (resp.status === 200 && resp.body) {
        this.applyRules(resp.body);
        this.newSubject.set('');
        this.addError.set('');
        return;
      }
      throw Object.assign(new Error('Add failed.'), { error: { error: 'Add failed.' } });
    });
  }

  async deleteIgnoredSubject(index: number) {
    const lang = this.selectedLanguage();
    const subjects = this.ignoredSubjects();
    if (!lang || this.isMutating()) {
      return;
    }
    const term = subjects[index];
    if (!term) {
      return;
    }

    if (!(await this.confirm('Remove ignored subject', `Stop ignoring “${term}” for ${lang}?`))) {
      return;
    }

    await this.mutate(async headers => {
      const resp = await firstValueFrom(
        this.http.delete<LanguageTitleCasingRulesResponse>(
          this.ignoredSubjectUrl(lang, term),
          { headers, observe: 'response' }
        )
      );
      if (resp.status === 200 && resp.body) {
        this.applyRules(resp.body);
        return;
      }
      throw Object.assign(new Error('Delete failed.'), { error: { error: 'Delete failed.' } });
    });
  }

  private async mutate(action: (headers: HttpHeaders) => Promise<void>) {
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
    } finally {
      this.isMutating.set(false);
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

      const [languagesResp, subjectsResp] = await Promise.all([
        firstValueFrom(
          this.http.get<{ [key: string]: string }>(
            new URL('/languages', environment.api).toString(),
            { headers, observe: 'response' }
          )
        ),
        firstValueFrom(
          this.http.get<Subject[]>(
            new URL('/subjects', environment.api).toString(),
            { headers, observe: 'response' }
          )
        )
      ]);

      if (languagesResp.status !== 200 || !languagesResp.body) {
        this.isInError.set(true);
        this.errorMessage.set('Failed to load languages.');
        this.isLoading.set(false);
        return;
      }

      if (subjectsResp.status !== 200 || !subjectsResp.body) {
        this.isInError.set(true);
        this.errorMessage.set('Failed to load subjects.');
        this.isLoading.set(false);
        return;
      }

      const options = Object.entries(languagesResp.body)
        .map(([code, name]) => ({ code, name }))
        .filter(o => o.code !== 'en')
        .sort((a, b) => a.name.localeCompare(b.name));
      this.languageOptions.set(options);
      this.allSubjects.set(
        [...subjectsResp.body]
          .map(s => s.name)
          .sort((a, b) => a.localeCompare(b))
      );

      const initialLang = options[0]?.code ?? '';
      this.selectedLanguage.set(initialLang);
      if (initialLang) {
        await this.loadLanguageRules(initialLang, headers);
      }
    } catch (error) {
      console.error(error);
      this.isInError.set(true);
      this.errorMessage.set('Failed to load language ignored subjects.');
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
          this.rulesUrl(code),
          { headers: authHeaders, observe: 'response' }
        )
      );

      if (resp.status === 200 && resp.body) {
        this.applyRules(resp.body);
        return;
      }

      if (resp.status === 404) {
        this.isDefault.set(false);
        this.ignoredSubjects.set([]);
        return;
      }

      throw new Error('Failed to load ignored subjects.');
    } catch (error: any) {
      if (error?.status === 404) {
        this.isDefault.set(false);
        this.ignoredSubjects.set([]);
        return;
      }
      console.error(error);
      this.isInError.set(true);
      this.errorMessage.set('Failed to load ignored subjects.');
    }
  }

  private applyRules(rules: LanguageTitleCasingRulesResponse) {
    this.isDefault.set(rules.isDefault);
    this.ignoredSubjects.set([...(rules.ignoredSubjects ?? [])]);
  }

  private rulesUrl(code: string): string {
    return new URL(
      `/title-casing-rules/${encodeURIComponent(code)}`,
      environment.api
    ).toString();
  }

  private ignoredSubjectsUrl(code: string): string {
    return new URL(
      `/title-casing-rules/${encodeURIComponent(code)}/ignored-subjects`,
      environment.api
    ).toString();
  }

  private ignoredSubjectUrl(code: string, term: string): string {
    return new URL(
      `/title-casing-rules/${encodeURIComponent(code)}/ignored-subjects/${encodeURIComponent(term)}`,
      environment.api
    ).toString();
  }

  private async confirm(title: string, question: string): Promise<boolean> {
    const ref = this.dialog.open(ConfirmComponent, {
      data: { title, question },
      disableClose: true,
      autoFocus: true
    });
    const result = await firstValueFrom(ref.afterClosed());
    return result?.result === true;
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
