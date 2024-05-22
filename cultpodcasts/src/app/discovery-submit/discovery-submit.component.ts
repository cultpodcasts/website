import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { AuthService, GetTokenSilentlyOptions } from '@auth0/auth0-angular';
import { IDiscoverySubmit } from '../IDiscoverySubmit';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';


@Component({
  selector: 'app-discovery-submit',
  templateUrl: './discovery-submit.component.html',
  styleUrls: ['./discovery-submit.component.sass']
})
export class DiscoverySubmitComponent {
  isAuthenticated: boolean = false;
  submitted: boolean = false;
  submitError: boolean = false;
  isSending: boolean = false;

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<DiscoverySubmitComponent>,
    private auth: AuthService) {
    auth.isAuthenticated$.subscribe(x => this.isAuthenticated = x);
  }

  public async submit(data: IDiscoverySubmit) {
    var token = firstValueFrom(this.auth.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));
    token.then(_token => {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + _token);
      const endpoint = new URL("/discovery-curation", environment.api).toString();
      this.isSending = true;
      this.http.post(endpoint, {
        ids: data.documentIds,
        urls: data.urls
      }, { headers: headers })
        .subscribe(
          resp => {
            this.submitted = true;
            this.isSending = false;
            this.dialogRef.close({ submitted: true });
          },
          err => {
            this.isSending = false;
            this.submitError = true;
          })
    }).catch(r => {
      this.isSending = false;
      this.submitError = true;
    });
  }

  close() {
    this.dialogRef.close({ submitted: false });
  }


}
