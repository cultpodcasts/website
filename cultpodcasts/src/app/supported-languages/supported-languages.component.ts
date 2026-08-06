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
  languages = signal<SupportedLanguage[]>([]);
  newCode = '';
  newName = '';
  editingIndex = signal<number | null>(null);
  editingCode = '';
  editingName = '';

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

  addLanguage() {
    const code = this.newCode.trim();
    const name = this.newName.trim();
    if (!code || !name) {
      return;
    }
    if (this.languages().some(l => l.code.toLowerCase() === code.toLowerCase())) {
      return;
    }
    this.languages.update(list => [...list, { code, name }].sort((a, b) => a.name.localeCompare(b.name)));
    this.newCode = '';
    this.newName = '';
  }

  startEdit(index: number) {
    const row = this.languages()[index];
    this.editingIndex.set(index);
    this.editingCode = row.code;
    this.editingName = row.name;
  }

  saveEdit() {
    const index = this.editingIndex();
    if (index == null) {
      return;
    }
    const code = this.editingCode.trim();
    const name = this.editingName.trim();
    if (!code || !name) {
      return;
    }
    if (this.languages().some((l, i) => i !== index && l.code.toLowerCase() === code.toLowerCase())) {
      return;
    }
    this.languages.update(list => {
      const next = [...list];
      next[index] = { code, name };
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
    this.cancelEdit();
  }

  cancelEdit() {
    this.editingIndex.set(null);
    this.editingCode = '';
    this.editingName = '';
  }

  deleteLanguage(index: number) {
    this.languages.update(list => list.filter((_, i) => i !== index));
    if (this.editingIndex() === index) {
      this.cancelEdit();
    }
  }

  async onSave() {
    if (!this.canSave()) {
      return;
    }

    this.isSaving.set(true);
    this.isInError.set(false);
    this.errorMessage.set('');

    const body: SupportedLanguagesUpdate = {
      languages: this.languages()
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
