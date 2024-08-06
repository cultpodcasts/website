import { Component } from '@angular/core';
import { SubjectEntity } from '../subject-entity';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { NgIf } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { environment } from './../../environments/environment';
import { firstValueFrom } from 'rxjs';


@Component({
  selector: 'app-edit-subject-send',
  standalone: true,
  imports: [MatDialogModule, NgIf, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './edit-subject-send.component.html',
  styleUrl: './edit-subject-send.component.sass'
})
export class EditSubjectSendComponent {
  isSending: boolean = true;
  sendError: boolean = false;

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<EditSubjectSendComponent>,
    private auth: AuthServiceWrapper) {
  }

  public submit(subjectId: string, changes: SubjectEntity) {
    var token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));
    token.then(_token => {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + _token);
      const episodeEndpoint = new URL(`/subject/${subjectId}`, environment.api).toString();
      this.http.post(episodeEndpoint, changes, { headers: headers, observe: "response" })
        .subscribe(
          {
            next: resp => {
              this.dialogRef.close({ updated: true });
            },
            error: e => {
              this.isSending = false;
              this.sendError = true;
              console.log(e);
            }
          }
        )
    }).catch(x => {
      this.isSending = false;
      this.sendError = true;
      console.log(x);
    });
  }

  close() {
    this.dialogRef.close({ updated: false });
  }
}
