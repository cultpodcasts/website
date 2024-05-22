import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { IShare } from '../IShare';
import { ShareMode } from "../ShareMode";
import { AuthService, GetTokenSilentlyOptions } from '@auth0/auth0-angular';
import { environment } from './../../environments/environment';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-send-podcast',
  templateUrl: './send-podcast.component.html',
  styleUrls: ['./send-podcast.component.sass']
})

export class SendPodcastComponent {
  submitted: boolean = false;
  isSending: boolean = false;
  urlShareError: boolean = false;
  urlTextError: boolean = false;
  unknownError: boolean = false;
  submitError: boolean = false;
  shareUrl: URL | undefined;
  spotify: RegExp = /^(?:https?:)?\/\/open\.spotify\.com\/episode\/[A-Za-z\d]+/;
  youtube: RegExp = /^(?:https?:\/\/)?(?:(?:www\.)?youtube\.com\/(?:watch\?v=|live\/)|youtu\.be\/)[A-Za-z\d\-\_]+/;
  apple: RegExp = /^(?:https?:)?\/\/podcasts\.apple\.com\/(\w+\/)?podcast\/[a-z\-0-9]+\/id\d+\?i=\d+/;
  isAuthenticated: boolean = false;

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<SendPodcastComponent>,
    private auth: AuthService) {
    auth.isAuthenticated$.subscribe(x => this.isAuthenticated = x);
  }

  close() {
    this.dialogRef.close({ submitted: this.submitted });
  }

  public async submit(data: IShare) {
    let matchedUrl: string | undefined;
    let url: URL | undefined;

    if (this.spotify.test(data.url.toString()) ||
      this.youtube.test(data.url.toString()) ||
      this.apple.test(data.url.toString())) {
      this.isSending = true;

      if (this.spotify.test(data.url.toString())) {
        let match = data.url.toString().match(this.spotify);
        if (match != null) {
          matchedUrl = match[0];
        }
      } else if (this.youtube.test(data.url.toString())) {
        let match = data.url.toString().match(this.youtube);
        if (match != null) {
          matchedUrl = match[0];
        }
      } else if (this.apple.test(data.url.toString())) {
        let match = data.url.toString().match(this.apple);
        if (match != null) {
          matchedUrl = match[0];
        }
      }

      if (matchedUrl) {
        try {
          url = new URL(matchedUrl);
        } catch {
          if (!/^\w+\:\/\//.test(matchedUrl)) {
            try {
              url = new URL("https://" + matchedUrl);
            } catch { }
          }
        }

        if (url) {
          const body = { url: url.toString(), podcastId: data.podcastId };

          let headers: HttpHeaders = new HttpHeaders();

          if (this.isAuthenticated || localStorage.getItem("hasLoggedIn")) {
            const accessTokenOptions: GetTokenSilentlyOptions = {
              authorizationParams: {
                audience: `https://api.cultpodcasts.com/`,
                scope: 'submit'
              }
            };
            let token: string | undefined;
            try {
              token = await firstValueFrom(this.auth.getAccessTokenSilently(accessTokenOptions));
            } catch (e) {
              console.log(e);
            }
            if (token) {
              headers = headers.set("Authorization", "Bearer " + token);
            }
          }
          try {
            await firstValueFrom(this.http.post(new URL("/submit", environment.api).toString(), body, { headers: headers }));
            this.submitted = true;
            this.close();
          } catch (error) {
            this.isSending = false;
            this.submitError = true;
          }

        }
      }

    }
    if (!matchedUrl || !url) {
      if (data.shareMode == ShareMode.Share) {
        this.urlShareError = true;
        this.shareUrl = data.url;
      } else if (data.shareMode == ShareMode.Text) {
        this.urlTextError = true;
        this.shareUrl = data.url;
      } else {
        this.unknownError = true;
      }
    }
  }
}
