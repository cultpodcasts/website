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

  addLanguage() {
    const name = this.newName.trim();
    this.addError.set('');
    if (!name) {
      return;
    }
    if (this.languages().some(l => l.name.toLowerCase() === name.toLowerCase())) {
      this.addError.set('That language is already in the list.');
      return;
    }
    // Code is derived server-side from the .NET culture English name on Save.
    this.languages.update(list => [...list, { code: '', name }].sort((a, b) => a.name.localeCompare(b.name)));
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

      // Read published R2 map via existing CF API (same as podcast/episode dialogs).
      const resp = await firstValueFrom(
        this.http.get<{ [key: string]: string }>(
          new URL('/languages', environment.api).toString(),
          { headers, observe: 'response' }
        )
      );

      if (resp.status === 200 && resp.body) {
        this.languages.set(
          Object.entries(resp.body)
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
