import { HttpClient } from '@angular/common/http';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { IShare, ShareMode } from '../IShare';

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
  spotify: RegExp = /https:\/\/open\.spotify\.com\/episode\/[A-Za-z\d]+/;
  youtube: RegExp = /https:\/\/(?:www\.youtube\.com\/watch\?v=|youtu\.be\/)[A-Za-z\d\-]+/;
  apple: RegExp = /https:\/\/podcasts\.apple\.com\/(\w+\/)?podcast\/[a-z\-0-9]+\/id\d+\?i=\d+/;

  constructor(
    http: HttpClient,
    private dialogRef: MatDialogRef<SendPodcastComponent>,
    @Inject(MAT_DIALOG_DATA) public data: IShare) {

    let url: URL | undefined;

    if (this.spotify.test(data.url.toString()) ||
      this.youtube.test(data.url.toString()) ||
      this.apple.test(data.url.toString())) {
      this.isSending = true;

      if (this.spotify.test(data.url.toString())) {
        let match = data.url.toString().match(this.spotify);
        if (match != null) {
          url = new URL(match[0]);
        }
      } else if (this.youtube.test(data.url.toString())) {
        let match = data.url.toString().match(this.youtube);
        if (match != null) {
          url = new URL(match[0]);
        }
      } else if (this.apple.test(data.url.toString())) {
        let match = data.url.toString().match(this.apple);
        if (match != null) {
          url = new URL(match[0]);
        }
      }
      if (url) {
        const body = { url: url.toString() };
        http.post("https://api.cultpodcasts.com/submit", body).subscribe(
          data => {
            this.submitted = true;
            this.close();
          },
          error => {
            this.isSending = false;
            this.submitError = true;
          });
      }
    }
    if (!url) {
      if (data.shareMode == ShareMode.Share) {
        this.urlShareError = true;
        this.shareUrl= data.url;
      } else if (data.shareMode == ShareMode.Text) {
        this.urlTextError = true;
        this.shareUrl= data.url;
      } else {
        this.unknownError = true;
      }
    }
  }



  close() {
    this.dialogRef.close({ submitted: this.submitted });
  }

}
