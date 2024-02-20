import { HttpClient } from '@angular/common/http';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-send-podcast',
  templateUrl: './send-podcast.component.html',
  styleUrls: ['./send-podcast.component.sass']
})

export class SendPodcastComponent {
  submitted:boolean= false;
  isSending: boolean = false;
  urlError: boolean = false;
  submitError: boolean = false;
  spotify: RegExp = /https:\/\/open.spotify.com\/episode\/[A-Za-z\d]+/;
  youtube: RegExp = /https:\/\/www.youtube.com\/\?v=\/[A-Za-z\d]+/;
  apple: RegExp = /https:\/\/podcasts.apple.com\/(\w+\/)?podcast\/[a-z\-]+\/id\d+\?i=\d+/

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<SendPodcastComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any) {
    const submitedUrl: URL = data.url;
    if (this.spotify.test(submitedUrl.toString()) || this.youtube.test(submitedUrl.toString()) || this.apple.test(submitedUrl.toString())) {
      this.isSending = true;

      let url: URL | undefined;
      if (this.spotify.test(submitedUrl.toString())) {
        let match = submitedUrl.toString().match(this.spotify);
        if (match != null) {
          url = new URL(match[0]);
        } else {
          this.urlError = true;

        }
      } else if (this.youtube.test(submitedUrl.toString())) {
        let match = submitedUrl.toString().match(this.youtube);
        if (match != null) {
          url = new URL(match[0]);
        } else {
          this.urlError = true;
        }
      } else if (this.apple.test(submitedUrl.toString())) {
        let match = submitedUrl.toString().match(this.apple);
        if (match != null) {
          url = new URL(match[0]);
        } else {
          this.urlError = true;
        }
      }
      if (url) {
        const body = { url: url.toString() };
        http.post("https://api.cultpodcasts.com/submit", body).subscribe(
          data => {
            console.log('success', data);
            this.submitted= true;
            this.close();
          },
          error => {
            console.log('Error submitting Url', error);
            this.isSending = false;
            this.submitError = true;
          });
      }
    } else {
      this.urlError = true;
    }
  }

  ngOnInit() { }

  close() {
    this.dialogRef.close({ submitted: this.submitted });
  }

}
