import { Component, Inject } from '@angular/core';
import { Person } from '../person.interface';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { environment } from './../../environments/environment';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-edit-person-send',
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './edit-person-send.component.html',
  styleUrl: './edit-person-send.component.sass'
})
export class EditPersonSendComponent {
  isSending: boolean = true;
  sendError: boolean = false;
  conflict: string | undefined;
  create: boolean;

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<EditPersonSendComponent>,
    private auth: AuthServiceWrapper,
    @Inject(MAT_DIALOG_DATA) public data: { create: boolean }
  ) {
    this.create = data.create;
  }

  public submit(personId: string, changes: Person, create: boolean) {
    var token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));
    token.then(_token => {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + _token);

      if (create) {
        const personEndpoint = new URL(`/person`, environment.api).toString();
        this.http.put<Person>(personEndpoint, changes, { headers: headers, observe: "response" })
          .subscribe(
            {
              next: resp => {
                if (resp.status == 202) {
                  this.dialogRef.close({
                    updated: true,
                    person: resp.body,
                    personName: resp.body?.name ?? changes.name
                  });
                }
              },
              error: e => {
                if (e.status == 409) {
                  this.isSending = false;
                  this.sendError = true;
                  this.conflict = e.error.conflict;
                } else {
                  this.isSending = false;
                  this.sendError = true;
                  console.error(e);
                }
              }
            }
          );
      } else {
        const personEndpoint = new URL(`/person/${personId}`, environment.api).toString();
        this.http.post(personEndpoint, changes, { headers: headers, observe: "response" })
          .subscribe(
            {
              next: resp => {
                this.dialogRef.close({ updated: true, personName: changes.name });
              },
              error: e => {
                this.isSending = false;
                this.sendError = true;
                console.error(e);
              }
            }
          );
      }
    }).catch(x => {
      this.isSending = false;
      this.sendError = true;
      console.error(x);
    });
  }

  close() {
    if (this.conflict) {
      this.dialogRef.close({ conflict: this.conflict });
    } else {
      this.dialogRef.close({ updated: false });
    }
  }
}
