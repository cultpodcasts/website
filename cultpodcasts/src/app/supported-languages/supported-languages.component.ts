import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
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
  SupportedLanguagesResponse
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
    MatAutocompleteModule,
    MatOptionModule,
    FormsModule
  ],
  templateUrl: './supported-languages.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './supported-languages.component.sass'
})
export class SupportedLanguagesComponent {
  @ViewChild(MatAutocompleteTrigger) private nameAutoTrigger?: MatAutocompleteTrigger;

  isLoading = signal(true);
  isMutating = signal(false);
  isInError = signal(false);
  errorMessage = signal('');
  addError = signal('');
  languages = signal<SupportedLanguage[]>([]);
  filteredCultures = signal<NeutralCulture[]>([]);
  /** English/native/alias spellings → culture code+display from GET /supported-languages/cultures */
  private culturesByName = new Map<string, NeutralCulture>();
  private culturesList: NeutralCulture[] = [];
  private didMutate = false;
  newName = '';

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<SupportedLanguagesComponent, { saved?: boolean }>
  ) { }

  async ngOnInit() {
    await this.load();
  }

  close() {
    this.dialogRef.close({ saved: this.didMutate });
  }

  trackLanguage(lang: SupportedLanguage, index: number): string {
    return lang.code ? `code:${lang.code}` : `new:${lang.name}:${index}`;
  }

  onNameModelChange(value: string) {
    if (!value?.trim()) {
      this.addError.set('');
    }
    this.refreshFilteredCultures();
  }

  onAddKeydown(event: Event) {
    // Let Material pick the highlighted option; Add/Enter after the panel closes.
    if (this.nameAutoTrigger?.panelOpen) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    void this.addLanguage();
  }

  async addLanguage() {
    const name = this.newName.trim();
    this.addError.set('');
    if (!name || this.isMutating()) {
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

    this.isMutating.set(true);
    this.isInError.set(false);
    this.errorMessage.set('');

    try {
      const headers = await this.authHeaders();
      if (!headers) {
        this.isInError.set(true);
        this.errorMessage.set('Could not get admin token.');
        this.isMutating.set(false);
        return;
      }

      const resp = await firstValueFrom(
        this.http.post<SupportedLanguagesResponse>(
          new URL('/supported-languages', environment.api).toString(),
          { name },
          { headers, observe: 'response' }
        )
      );

      if (resp.status === 200 && resp.body) {
        this.languages.set([...resp.body.languages]);
        this.newName = '';
        this.didMutate = true;
        this.refreshFilteredCultures();
        this.isMutating.set(false);
        return;
      }

      this.isInError.set(true);
      this.errorMessage.set('Add failed.');
      this.isMutating.set(false);
    } catch (error: any) {
      console.error(error);
      this.addError.set(error?.error?.error ?? 'Add failed.');
      this.isMutating.set(false);
    }
  }

  async deleteLanguage(index: number) {
    if (this.isMutating()) {
      return;
    }

    const lang = this.languages()[index];
    if (!lang?.code) {
      return;
    }

    this.isMutating.set(true);
    this.isInError.set(false);
    this.errorMessage.set('');
    this.addError.set('');

    try {
      const headers = await this.authHeaders();
      if (!headers) {
        this.isInError.set(true);
        this.errorMessage.set('Could not get admin token.');
        this.isMutating.set(false);
        return;
      }

      const resp = await firstValueFrom(
        this.http.delete<SupportedLanguagesResponse>(
          new URL(`/supported-languages/${encodeURIComponent(lang.code)}`, environment.api).toString(),
          { headers, observe: 'response' }
        )
      );

      if (resp.status === 200 && resp.body) {
        this.languages.set([...resp.body.languages]);
        this.didMutate = true;
        this.refreshFilteredCultures();
        this.isMutating.set(false);
        return;
      }

      this.isInError.set(true);
      this.errorMessage.set('Delete failed.');
      this.isMutating.set(false);
    } catch (error: any) {
      console.error(error);
      this.isInError.set(true);
      this.errorMessage.set(error?.error?.error ?? 'Delete failed.');
      this.isMutating.set(false);
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

  private refreshFilteredCultures() {
    const listedCodes = new Set(
      this.languages().map(l => l.code.toLowerCase()).filter(Boolean)
    );
    const available = this.culturesList.filter(c => !listedCodes.has(c.code.toLowerCase()));
    const q = this.newName.trim().toLowerCase();
    const qFold = this.foldKey(this.newName);

    if (!q) {
      this.filteredCultures.set(available);
      return;
    }

    this.filteredCultures.set(
      available.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        this.foldKey(c.name).includes(qFold)
      )
    );
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
        firstValueFrom(
          this.http.get<SupportedLanguagesResponse>(
            new URL('/supported-languages', environment.api).toString(),
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
        const byCode = new Map<string, NeutralCulture>();
        for (const culture of culturesResp.body.cultures) {
          const row = { code: culture.code, name: culture.name };
          byCode.set(culture.code.toLowerCase(), row);
          map.set(this.lookupKey(culture.name), row);
          map.set(this.foldKey(culture.name), row);
        }
        this.culturesByName = map;
        this.culturesList = [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name));
      } else {
        this.isInError.set(true);
        this.errorMessage.set('Failed to load culture list for Add validation.');
        this.isLoading.set(false);
        return;
      }

      if (languagesResp.status === 200 && languagesResp.body) {
        this.languages.set(
          [...languagesResp.body.languages].sort((a, b) => a.name.localeCompare(b.name))
        );
        this.refreshFilteredCultures();
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
