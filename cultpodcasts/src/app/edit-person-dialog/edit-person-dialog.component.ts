import { Component, Inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PersonForm } from '../person-form.interface';
import { Person } from '../person.interface';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';
import { EditPersonSendComponent } from '../edit-person-send/edit-person-send.component';
import { CdkTextareaAutosize, TextFieldModule } from '@angular/cdk/text-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-edit-person-dialog',
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    CdkTextareaAutosize,
    TextFieldModule,
    MatInputModule
  ],
  templateUrl: './edit-person-dialog.component.html',
  styleUrl: './edit-person-dialog.component.sass'
})
export class EditPersonDialogComponent {
  personName: string | undefined;
  isLoading: boolean = true;
  isInError: boolean = false;
  form: FormGroup<PersonForm> | undefined;
  originalPerson: Person | undefined;
  personId: string | undefined;
  create: boolean;
  conflict: string | undefined;

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<EditPersonDialogComponent, any>,
    @Inject(MAT_DIALOG_DATA) public data: { personName: string | undefined, create: boolean | undefined },
    private dialog: MatDialog,
  ) {
    this.personName = data.personName;
    this.create = data.create || false;
  }

  ngOnInit() {
    this.isLoading = true;
    if (this.create) {
      this.originalPerson = { id: '', name: '' };
      this.form = new FormGroup<PersonForm>({
        name: new FormControl(this.personName ?? '', { nonNullable: true, validators: [Validators.required] }),
        aliases: new FormControl([], { nonNullable: false }),
        twitterHandle: new FormControl('', { nonNullable: false }),
        blueskyHandle: new FormControl('', { nonNullable: false })
      });
      this.isLoading = false;
      return;
    }

    var token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));
    token.then(_token => {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + _token);
      const personEndpoint = new URL(`/person/${encodeURIComponent(this.personName!)}`, environment.api).toString();
      this.http.get<Person>(personEndpoint, { headers: headers })
        .subscribe({
          next: resp => {
            this.personId = resp.id;
            this.originalPerson = resp;
            this.form = new FormGroup<PersonForm>({
              name: new FormControl(resp.name, { nonNullable: true, validators: [Validators.required] }),
              aliases: new FormControl(resp.aliases, { nonNullable: false }),
              twitterHandle: new FormControl(resp.twitterHandle ?? '', { nonNullable: false }),
              blueskyHandle: new FormControl(resp.blueskyHandle ?? '', { nonNullable: false })
            });
            this.isLoading = false;
          },
          error: e => {
            this.isLoading = false;
            this.isInError = true;
          }
        });
    }).catch(x => {
      this.isLoading = false;
      this.isInError = true;
    });
  }

  close() {
    if (this.conflict) {
      this.dialogRef.close({ conflict: this.conflict });
    } else {
      this.dialogRef.close({ closed: true });
    }
  }

  searchTerm(): string {
    return (this.form?.controls.name.value ?? this.personName ?? '').trim();
  }

  searchX() {
    const q = this.searchTerm();
    if (!q) {
      return;
    }
    window.open(`https://x.com/search?q=${encodeURIComponent(q)}&f=user`, '_blank', 'noopener');
  }

  searchBluesky() {
    const q = this.searchTerm();
    if (!q) {
      return;
    }
    window.open(`https://bsky.app/search?q=${encodeURIComponent(q)}`, '_blank', 'noopener');
  }

  translateForEntity(x: FormControl<string | undefined | null>): string | undefined {
    if (x.value) return x.value;
    return "";
  }

  translateForEntityA(x: FormControl<string[] | undefined | null>): string[] | undefined {
    if (x.value) {
      const valueS: any = x.value;
      if (valueS.push) {
        return x.value;
      } else if (valueS.split) {
        const valueSt: string = valueS;
        return valueSt.split(",").map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      }
    };
    return [];
  }

  onSubmit() {
    if (!this.form?.valid) {
      return;
    }

    const update: Person = {
      id: this.personId ?? '',
      name: this.translateForEntity(this.form!.controls.name)!,
      aliases: this.translateForEntityA(this.form!.controls.aliases),
      twitterHandle: this.translateForEntity(this.form!.controls.twitterHandle),
      blueskyHandle: this.translateForEntity(this.form!.controls.blueskyHandle)
    };

    const changes = this.getChanges(this.originalPerson!, update);
    if (Object.keys(changes).length == 0) {
      this.dialogRef.close({ noChange: true });
    } else {
      this.send(this.personId!, changes);
    }
  }

  isSameA(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
    if (!a && !b) {
      return true;
    }
    if (!a && b?.length == 0) {
      return true;
    }
    if (a?.length == 0 && !b) {
      return true;
    }
    return JSON.stringify(a) == JSON.stringify(b);
  }

  isSame(a: string | null | undefined, b: string | null | undefined): boolean {
    if (!a && !b) {
      return true;
    }
    if ((a === '' || a == null) && (b === '' || b == null)) {
      return true;
    }
    return JSON.stringify(a) == JSON.stringify(b);
  }

  getChanges(prev: Person, now: Person): Partial<Person> & { name?: string } {
    if (this.create) {
      return {
        name: now.name,
        aliases: now.aliases,
        twitterHandle: now.twitterHandle,
        blueskyHandle: now.blueskyHandle
      };
    }

    const changes: Partial<Person> = {};
    if (!this.isSameA(prev.aliases, now.aliases)) changes.aliases = now.aliases;
    if (!this.isSame(prev.twitterHandle, now.twitterHandle)) changes.twitterHandle = now.twitterHandle ?? '';
    if (!this.isSame(prev.blueskyHandle, now.blueskyHandle)) changes.blueskyHandle = now.blueskyHandle ?? '';
    return changes;
  }

  send(id: string, changes: Partial<Person>) {
    const payload = changes as Person;
    const dialogRef = this.dialog.open(EditPersonSendComponent, { disableClose: true, autoFocus: true, data: { create: this.create } });
    dialogRef.componentInstance.submit(id, payload, this.create);
    dialogRef.afterClosed().subscribe(async result => {
      if (result?.updated) {
        this.dialogRef.close({
          updated: true,
          personName: result.personName ?? changes.name,
          person: result.person
        });
      } else if (result?.conflict) {
        this.conflict = result.conflict;
      }
    });
  }
}
