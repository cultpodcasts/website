import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';
import { Episode } from '../episode';
import { Subject } from '../subject';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { EpisodeForm } from '../episode-form';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { EpisodePost } from '../EpisodePost';
import { AddEpisodeSendComponent } from '../add-episode-send/add-episode-send.component';
import { MatExpansionModule } from '@angular/material/expansion';

@Component({
  selector: 'app-add-episode-dialog',
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatExpansionModule
  ],
  templateUrl: './add-episode-dialog.component.html',
  styleUrl: './add-episode-dialog.component.sass'
})
export class AddEpisodeDialogComponent {
  episodeId: string;
  isNewPodcast: boolean;
  isLoading: boolean = true;
  isInError: boolean = false;
  subjects: string[] = [];

  form: FormGroup<EpisodeForm> | undefined;
  originalEpisode: Episode | undefined;
  podcastName: string | undefined;

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<AddEpisodeDialogComponent, any>,
    @Inject(MAT_DIALOG_DATA) public data: { episodeId: string, isNewPodcast: boolean },
    private fb: FormBuilder,
    private dialog: MatDialog,
  ) {
    this.episodeId = data.episodeId;
    this.isNewPodcast = data.isNewPodcast;
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
        .subscribe(
          {
            next: resp => {
              this.originalEpisode = resp;
              this.podcastName = resp.podcastName;
              this.form = new FormGroup<EpisodeForm>({
                title: new FormControl(resp.title, { nonNullable: true }),
                description: new FormControl(resp.description, { nonNullable: true }),
                posted: new FormControl(resp.posted, { nonNullable: true }),
                tweeted: new FormControl(resp.tweeted, { nonNullable: true }),
                blueskyPosted: new FormControl(resp.bluesky ?? false, { nonNullable: true }),
                ignored: new FormControl(resp.ignored, { nonNullable: true }),
                explicit: new FormControl(resp.explicit, { nonNullable: true }),
                removed: new FormControl(resp.removed, { nonNullable: true }),
                release: new FormControl(this.dateToLocalISO(resp.release), { nonNullable: true }),
                duration: new FormControl(resp.duration, { nonNullable: true }),
                spotify: new FormControl(resp.urls.spotify || null),
                spotifyImage: new FormControl(resp.images?.spotify || null),
                apple: new FormControl(resp.urls.apple || null),
                appleImage: new FormControl(resp.images?.apple || null),
                youtube: new FormControl(resp.urls.youtube || null),
                youtubeImage: new FormControl(resp.images?.youtube || null),
                otherImage: new FormControl(resp.images?.other || null),
                bbc: new FormControl(resp.urls.bbc || null),
                internetArchive: new FormControl(resp.urls.internetArchive || null),
                subjects: new FormControl(resp.subjects, { nonNullable: true }),
                searchTerms: new FormControl(resp.searchTerms || null),
              });
              const subjectsEndpoint = new URL("/subjects", environment.api).toString();
              this.http.get<Subject[]>(subjectsEndpoint, { headers: headers }).subscribe({
                next: d => {
                  this.subjects = resp.subjects.concat(d.filter(x => !resp.subjects.includes(x.name)).map(x => x.name));
                  this.isLoading = false;
                },
                error: e => {
                  this.isLoading = false;
                  this.isInError = true;
                }
              })
            },
            error: e => {
              this.isLoading = false;
              this.isInError = true;
            }
          }
        )
    }).catch(x => {
      this.isLoading = false;
      this.isInError = true;
    });
  }

  close() {
    this.dialogRef.close({ closed: true, isNewPodcast: this.isNewPodcast, podcastName: this.podcastName });
  }

  onSubmit() {
    if (this.form?.valid) {

      const update: Episode = {
        id: this.episodeId,
        title: this.form!.controls.title.value,
        description: this.form!.controls.description.value,
        posted: this.form!.controls.posted.value,
        tweeted: this.form!.controls.tweeted.value,
        bluesky: this.form!.controls.blueskyPosted.value,
        ignored: this.form!.controls.ignored.value,
        removed: this.form!.controls.removed.value,
        explicit: this.form!.controls.explicit.value,
        release: new Date(this.form!.controls.release.value),
        duration: this.form!.controls.duration.value,
        urls: {
          spotify: this.form!.controls.spotify.value,
          apple: this.form!.controls.apple.value,
          youtube: this.form!.controls.youtube.value,
          bbc: this.form!.controls.bbc.value,
          internetArchive: this.form!.controls.internetArchive.value
        },
        images: {
          spotify: this.form!.controls.spotifyImage.value,
          apple: this.form!.controls.appleImage.value,
          youtube: this.form!.controls.youtubeImage.value,
          other: this.form!.controls.otherImage.value
        },
        subjects: this.form!.controls.subjects.value,
        searchTerms: this.form!.controls.searchTerms.value
      };

      var changes = this.getChanges(this.originalEpisode!, update);
      if (Object.keys(changes).length == 0) {
        this.dialogRef.close({ noChange: true, isNewPodcast: this.isNewPodcast, podcastName: this.podcastName });
      } else {
        this.send(this.episodeId, changes);
      }
    }
  }

  send(id: string, changes: EpisodePost) {
    const dialogRef = this.dialog.open(AddEpisodeSendComponent, { disableClose: true, autoFocus: true });
    dialogRef.componentInstance.submit(id, changes);
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        this.dialogRef.close({ updated: true, isNewPodcast: this.isNewPodcast, podcastName: this.podcastName });
      }
    });
  }

  getChanges(prev: Episode, now: Episode): EpisodePost {
    const nowReleaseDate = new Date(now.release).toISOString();
    var changes: EpisodePost = {};
    if (prev.description != now.description) changes.description = now.description;
    if (prev.duration != now.duration) changes.duration = now.duration;
    if (prev.explicit != now.explicit) changes.explicit = now.explicit;
    if (prev.ignored != now.ignored) changes.ignored = now.ignored;
    if (prev.posted != now.posted) changes.posted = now.posted;
    if (prev.tweeted != now.tweeted) changes.tweeted = now.tweeted;
    if (prev.bluesky ?? false != now.bluesky ?? false) changes.bluesky = now.bluesky ?? false;
    if (prev.release.toISOString() != nowReleaseDate) changes.release = nowReleaseDate;
    if (prev.removed != now.removed) changes.removed = now.removed;
    if (prev.searchTerms != now.searchTerms) changes.searchTerms = now.searchTerms;
    if (prev.subjects != now.subjects) changes.subjects = now.subjects;
    if (prev.title != now.title) changes.title = now.title;

    if ((!this.areEqual(prev.urls?.apple, now.urls?.apple)) ||
      (!this.areEqual(prev.urls?.spotify, now.urls?.spotify)) ||
      (!this.areEqual(prev.urls?.youtube, now.urls?.youtube)) ||
      (!this.areEqual(prev.urls?.bbc, now.urls?.bbc)) ||
      (!this.areEqual(prev.urls?.internetArchive, now.urls?.internetArchive))) {
      changes.urls = {};
    }
    if (!this.areEqual(prev.urls?.apple, now.urls?.apple)) changes.urls!.apple = now.urls?.apple ?? "";
    if (!this.areEqual(prev.urls?.spotify, now.urls?.spotify)) changes.urls!.spotify = now.urls?.spotify ?? "";
    if (!this.areEqual(prev.urls?.youtube, now.urls?.youtube)) changes.urls!.youtube = now.urls?.youtube ?? "";
    if (!this.areEqual(prev.urls?.bbc, now.urls?.bbc)) changes.urls!.bbc = now.urls?.bbc ?? "";
    if (!this.areEqual(prev.urls?.internetArchive, now.urls?.internetArchive)) changes.urls!.internetArchive = now.urls?.internetArchive ?? "";

    if ((!this.areEqual(prev.images?.apple, now.images?.apple)) ||
      (!this.areEqual(prev.images?.spotify, now.images?.spotify)) ||
      (!this.areEqual(prev.images?.youtube, now.images?.youtube)) ||
      (!this.areEqual(prev.images?.other, now.images?.other))) {
      changes.images = {};
    }
    if (!this.areEqual(prev.images?.apple, now.images?.apple)) changes.images!.apple = now.images?.apple ?? "";
    if (!this.areEqual(prev.images?.spotify, now.images?.spotify)) changes.images!.spotify = now.images?.spotify ?? "";
    if (!this.areEqual(prev.images?.youtube, now.images?.youtube)) changes.images!.youtube = now.images?.youtube ?? "";
    if (!this.areEqual(prev.images?.other, now.images?.other)) changes.images!.other = now.images?.other ?? "";
    return changes;
  }

  areEqual(url1: URL | null | undefined | string, url2: URL | null | undefined | string): boolean {
    let result: boolean;
    if ((url1 == undefined || url1 == null) && (url2 == undefined || url2 == null)) {
      result = true;
    } else if ((url1 == undefined || url1 == null) && (url2 != undefined && url2 != null)) {
      result = false;
    } else if ((url2 == undefined || url2 == null) && (url1 != undefined && url1 != null)) {
      result = false;
    } else {
      result = url1!.toString() === url2!.toString()
    }
    return result;
  }

  dateToLocalISO(date: Date) {
    const off = date.getTimezoneOffset()
    const absoff = Math.abs(off)
    return (new Date(date.getTime() - off * 60 * 1000).toISOString().substring(0, 23))
  }

  noCompareFunction() {
    return 0;
  }

}
