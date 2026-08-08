import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import {
  NeutralCulture,
  NeutralCulturesResponse,
  SupportedLanguage,
  SupportedLanguagesResponse,
  SupportedLanguagesUpdate
} from './supported-languages.interface';

@Component({
  selector: 'app-supported-languages',
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    FormsModule
  ],
  templateUrl: './supported-languages.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './supported-languages.component.sass'
})
export class SupportedLanguagesComponent {
  isLoading = signal(true);
  isSaving = signal(false);
  isInError = signal(false);
  errorMessage = signal('');
  addError = signal('');
  languages = signal<SupportedLanguage[]>([]);
  /** English/native/alias spellings → culture code+display from GET /supported-languages/cultures */
  private culturesByName = new Map<string, NeutralCulture>();
  newName = '';

  readonly canSave = computed(() =>
    !this.isLoading() && !this.isSaving() && this.languages().length > 0
  );

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<SupportedLanguagesComponent, { saved?: boolean }>
  ) { }

  async ngOnInit() {
    await this.load();
  }

  close() {
    this.dialogRef.close({ saved: false });
  }

  trackLanguage(lang: SupportedLanguage, index: number): string {
    return lang.code ? `code:${lang.code}` : `new:${lang.name}:${index}`;
  }

  onAddKeydown(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.addLanguage();
  }

  addLanguage() {
    const name = this.newName.trim();
    this.addError.set('');
    if (!name) {
      return;
    }

    const resolved = this.resolveCulture(name);
    if (!resolved?.code) {
      this.addError.set('Language not recognised. Use a .NET culture English or native name.');
      return;
    }

    const alreadyListed = this.languages().some(l =>
      l.code.toLowerCase() === resolved.code.toLowerCase() ||
      l.name.toLowerCase() === name.toLowerCase() ||
      l.name.toLowerCase() === resolved.name.toLowerCase());
    if (alreadyListed) {
      this.addError.set('That language is already in the list.');
      return;
    }

    this.languages.update(list =>
      [...list, { code: resolved.code, name: resolved.name }]
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    this.newName = '';
  }

  deleteLanguage(index: number) {
    this.languages.update(list => list.filter((_, i) => i !== index));
  }

  async onSave() {
    if (!this.canSave()) {
      return;
    }

    this.isSaving.set(true);
    this.isInError.set(false);
    this.errorMessage.set('');
    this.addError.set('');

    const body: SupportedLanguagesUpdate = {
      languages: this.languages().map(l => ({
        name: l.name,
        code: l.code ?? ''
      }))
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
        this.http.put<SupportedLanguagesResponse>(
          new URL('/supported-languages', environment.api).toString(),
          body,
          { headers, observe: 'response' }
        )
      );

      if (resp.status === 200 && resp.body) {
        this.languages.set([...resp.body.languages]);
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

  private resolveCulture(name: string): NeutralCulture | undefined {
    return this.culturesByName.get(this.lookupKey(name))
      ?? this.culturesByName.get(this.foldKey(name));
  }

  private lookupKey(name: string): string {
    return name.trim().toLowerCase();
  }

  private foldKey(name: string): string {
    return name.trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
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

      const [languagesResp, culturesResp] = await Promise.all([
        // Published R2 map — same names/codes currently registered (do not filter).
        firstValueFrom(
          this.http.get<{ [key: string]: string }>(
            new URL('/languages', environment.api).toString(),
            { headers, observe: 'response' }
          )
        ),
        firstValueFrom(
          this.http.get<NeutralCulturesResponse>(
            new URL('/supported-languages/cultures', environment.api).toString(),
            { headers, observe: 'response' }
          )
        )
      ]);

      if (culturesResp.status === 200 && culturesResp.body?.cultures) {
        const map = new Map<string, NeutralCulture>();
        for (const culture of culturesResp.body.cultures) {
          const row = { code: culture.code, name: culture.name };
          map.set(this.lookupKey(culture.name), row);
          map.set(this.foldKey(culture.name), row);
        }
        this.culturesByName = map;
      } else {
        this.isInError.set(true);
        this.errorMessage.set('Failed to load culture list for Add validation.');
        this.isLoading.set(false);
        return;
      }

      if (languagesResp.status === 200 && languagesResp.body) {
        this.languages.set(
          Object.entries(languagesResp.body)
            .map(([code, name]) => ({ code, name }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      } else {
        this.isInError.set(true);
        this.errorMessage.set('Failed to load languages.');
      }
    } catch (error) {
      console.error(error);
      this.isInError.set(true);
      this.errorMessage.set('Failed to load supported languages.');
    } finally {
      this.isLoading.set(false);
    }
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
