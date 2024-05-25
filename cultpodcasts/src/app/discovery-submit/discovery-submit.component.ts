import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
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
  submitError: boolean = false;
  isSending: boolean = false;
  ingestError: boolean = false;

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<DiscoverySubmitComponent>,
    private auth: AuthService) {
    auth.isAuthenticated$.subscribe(x => this.isAuthenticated = x);
  }

  public async submit(data: IDiscoverySubmit) {
    try {
      var token = await firstValueFrom(this.auth.getAccessTokenSilently({
        authorizationParams: {
          audience: `https://api.cultpodcasts.com/`,
          scope: 'curate'
        }
      }));
      if (token === "") {
        throw new Error("Unable to get access-token");
      }
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + token);
      const endpoint = new URL("/discovery-curation", environment.api).toString();
      this.isSending = true;
      var resp = await firstValueFrom<HttpResponse<any>>(this.http.post(endpoint, { ids: data.documentIds, urls: data.urls }, { headers: headers, observe: "response" }));
      if (resp.status === 200) {
        this.isSending = false;
        if (resp.body.errorsOccurred) {
          this.ingestError = true;
        } else {
          this.dialogRef.close({ submitted: true });
        }
      } else {
        this.isSending = false;
        this.submitError = true;
      }
    } catch (error) {
      this.isSending = false;
      this.submitError = true;
    }
  }

  close() {
    this.dialogRef.close({ submitted: false });
  }


}
