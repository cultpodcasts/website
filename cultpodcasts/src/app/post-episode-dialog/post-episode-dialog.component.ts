import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, Inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { PostForm } from '../PostForm';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';
import { PostEpisodeModel } from '../post-episode-model';
import { Episode } from '../episode';
import { EpisodePublishResponse } from '../episode-publish-response';

@Component({
  selector: 'app-post-episode-dialog',
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    ReactiveFormsModule,
    MatFormFieldModule
  ],
  templateUrl: './post-episode-dialog.component.html',
  styleUrl: './post-episode-dialog.component.sass'
})
export class PostEpisodeDialogComponent {
  isInError: boolean = false;
  isSending: boolean = true;
  form: FormGroup<PostForm> | undefined;
  episodeId: string | undefined;
  hasPosted: boolean = false;
  hasTweeted: boolean = false;
  hasBlueskyPosted: boolean = false;

  constructor(private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<PostEpisodeDialogComponent, any>,
    @Inject(MAT_DIALOG_DATA) public data: { episodeId: string }) {
    this.episodeId = data.episodeId;
    this.form = new FormGroup<PostForm>({
      tweet: new FormControl(false, { nonNullable: true }),
      post: new FormControl(false, { nonNullable: true }),
      blueskyPost: new FormControl(false, { nonNullable: true })
    });
  }

  ngOnInit() {
    var token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));
    token.then(_token => {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + _token);
      const episodeEndpoint = new URL(`/episode/${this.episodeId}`, environment.api).toString();
      this.http.get<Episode>(episodeEndpoint, { headers: headers })
        .subscribe({
          next: resp => {
            this.isSending = false;
            this.hasPosted = resp.posted;
            this.hasTweeted = resp.tweeted;
            this.hasBlueskyPosted = resp.bluesky == true;
            if (this.hasPosted) {
              this.form?.controls.post.disable();
            } else {
              if (!resp.ignored && !resp.removed &&
                ((!resp.youTubePodcast || resp.urls.youtube) &&
                  (!resp.applePodcast || resp.urls.apple) &&
                  (!resp.spotifyPodcast || resp.urls.spotify)
                )) {
                this.form?.controls.post.setValue(true);
              }
            }
            const readyForSocial: boolean = !resp.ignored && !resp.removed &&
              ((resp.primaryPostService == "Spotify" && resp.spotifyPodcast == true && resp.urls.spotify != null) ||
                (resp.primaryPostService == "YouTube" && resp.youTubePodcast == true && resp.urls.youtube != null) ||
                (resp.primaryPostService == null && (
                  (resp.youTubePodcast == true && resp.urls.youtube != null) ||
                  (!(resp.youTubePodcast == true) && (resp.spotifyPodcast == true) && resp.urls.spotify != null) ||
                  (!(resp.youTubePodcast == true) && !(resp.spotifyPodcast == true) && (resp.applePodcast == true) && resp.urls.apple != null)
                )));
            if (this.hasTweeted) {
              this.form?.controls.tweet.disable();
            }
            if (this.hasBlueskyPosted) {
              this.form?.controls.blueskyPost.disable();
            } else {
              if (readyForSocial) {
                this.form?.controls.blueskyPost.setValue(true);
              }
            }
            if (this.hasTweeted && this.hasPosted && this.hasBlueskyPosted) {
              this.dialogRef.close({ noChange: true });
            }
          },
          error: e => {
            this.isSending = false;
            this.isInError = true;
          }
        })
    }).catch(x => {
      this.isSending = false;
      this.isInError = true;
    });
  }

  close() {
    this.dialogRef.close({ closed: true });
  }

  onSubmit() {
    const model: PostEpisodeModel = {};
    let change: boolean = false;
    if (!this.hasTweeted && this.form?.controls.tweet.value) {
      change = true;
      model.tweet = true;
    }
    if (!this.hasPosted && this.form?.controls.post.value) {
      change = true;
      model.post = true;
    }
    if (!this.hasBlueskyPosted && this.form?.controls.blueskyPost.value) {
      change = true;
      model.blueskyPost = true;
    }
    if (change) {
      this.isSending = true;
      var token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
        authorizationParams: {
          audience: `https://api.cultpodcasts.com/`,
          scope: 'curate'
        }
      }));
      token.then(_token => {
        let headers: HttpHeaders = new HttpHeaders();
        headers = headers.set("Authorization", "Bearer " + _token);
        const episodeEndpoint = new URL(`/episode/publish/${this.episodeId}`, environment.api).toString();
        this.http.post<EpisodePublishResponse>(episodeEndpoint, model, { headers: headers })
          .subscribe(
            {
              next: resp => {
                this.isSending = false;
                this.dialogRef.close({ response: resp, expectation: model })
              },
              error: e => {
                this.isSending = false;
                this.isInError = true;
              }
            }
          )
      }).catch(x => {
        this.isSending = false;
        this.isInError = true;
      });
    } else {
      this.dialogRef.close({ noChange: true });
    }
  }
}
