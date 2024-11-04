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
import { EditEpisodeSendComponent } from '../edit-episode-send/edit-episode-send.component';

@Component({
  selector: 'app-edit-episode-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatFormFieldModule,
    MatSelectModule
  ],
  templateUrl: './edit-episode-dialog.component.html',
  styleUrl: './edit-episode-dialog.component.sass'
})
export class EditEpisodeDialogComponent {
  episodeId: string;
  isLoading: boolean = true;
  isInError: boolean = false;
  subjects: string[] = [];

  form: FormGroup<EpisodeForm> | undefined;
  originalEpisode: Episode | undefined;
  podcastName: string | undefined;

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<EditEpisodeDialogComponent, any>,
    @Inject(MAT_DIALOG_DATA) public data: { episodeId: string },
    private dialog: MatDialog,
  ) {
    this.episodeId = data.episodeId;
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
                ignored: new FormControl(resp.ignored, { nonNullable: true }),
                explicit: new FormControl(resp.explicit, { nonNullable: true }),
                removed: new FormControl(resp.removed, { nonNullable: true }),
                release: new FormControl(this.dateToLocalISO(resp.release), { nonNullable: true }),
                duration: new FormControl(resp.duration, { nonNullable: true }),
                spotify: new FormControl(resp.urls.spotify || null),
                apple: new FormControl(resp.urls.apple || null),
                youtube: new FormControl(resp.urls.youtube || null),
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
    this.dialogRef.close({ closed: true });
  }

  onSubmit() {
    if (this.form?.valid) {

      const update: Episode = {
        id: this.episodeId,
        title: this.form!.controls.title.value,
        description: this.form!.controls.description.value,
        posted: this.form!.controls.posted.value,
        tweeted: this.form!.controls.tweeted.value,
        ignored: this.form!.controls.ignored.value,
        removed: this.form!.controls.removed.value,
        explicit: this.form!.controls.explicit.value,
        release: new Date(this.form!.controls.release.value),
        duration: this.form!.controls.duration.value,
        urls: {
          spotify: this.form!.controls.spotify.value,
          apple: this.form!.controls.apple.value,
          youtube: this.form!.controls.youtube.value
        },
        subjects: this.form!.controls.subjects.value,
        searchTerms: this.form!.controls.searchTerms.value
      };

      var changes = this.getChanges(this.originalEpisode!, update);
      if (Object.keys(changes).length == 1 && Object.keys(changes.urls).length == 0) {
        this.dialogRef.close({ noChange: true });
      } else {
        this.send(this.episodeId, changes);
      }
    }
  }

  send(id: string, changes: EpisodePost) {
    const dialogRef = this.dialog.open(EditEpisodeSendComponent, { disableClose: true, autoFocus: true });
    dialogRef.componentInstance.submit(id, changes);
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        this.dialogRef.close({ updated: true });
      }
    });
  }

  getChanges(prev: Episode, now: Episode): EpisodePost {
    const nowReleaseDate = new Date(now.release).toISOString();
    var changes: EpisodePost = { urls: {} };
    if (prev.description != now.description) changes.description = now.description;
    if (prev.duration != now.duration) changes.duration = now.duration;
    if (prev.explicit != now.explicit) changes.explicit = now.explicit;
    if (prev.ignored != now.ignored) changes.ignored = now.ignored;
    if (prev.posted != now.posted) changes.posted = now.posted;
    if (prev.release.toISOString() != nowReleaseDate) changes.release = nowReleaseDate;
    if (prev.removed != now.removed) changes.removed = now.removed;
    if (prev.searchTerms != now.searchTerms) changes.searchTerms = now.searchTerms;
    if (prev.subjects != now.subjects) changes.subjects = now.subjects;
    if (prev.title != now.title) changes.title = now.title;
    if (prev.tweeted != now.tweeted) changes.tweeted = now.tweeted;
    if (prev.urls.apple?.toString() != now.urls.apple?.toString()) changes.urls.apple = now.urls.apple;
    if (prev.urls.spotify?.toString() != now.urls.spotify?.toString()) changes.urls.spotify = now.urls.spotify;
    if (prev.urls.youtube?.toString() != now.urls.youtube?.toString()) changes.urls.youtube = now.urls.youtube;
    return changes;
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
