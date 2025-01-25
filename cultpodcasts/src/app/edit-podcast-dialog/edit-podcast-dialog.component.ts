import { Component, Inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { EditPodcastForm } from "../edit-podcast-form.interface";
import { Podcast } from '../podcast.interface';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';
import { Subject } from '../subject.interface';
import { EditPodcastPost } from "../edit-podcast-post.interface";
import { EditPodcastSendComponent } from '../edit-podcast-send/edit-podcast-send.component';
import { PodcastServiceType } from "../podcast-service-type.enum";

@Component({
  selector: 'app-edit-podcast-dialog-component',
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatFormFieldModule,
    MatSelectModule
  ],
  templateUrl: './edit-podcast-dialog.component.html',
  styleUrl: './edit-podcast-dialog.component.sass'
})
export class EditPodcastDialogComponent {
  podcastName: string;
  isLoading: boolean = true;
  isInError: boolean = false;
  notFound: boolean = false;
  conflict: boolean = false;
  podcastServices = Object
    .values(PodcastServiceType)
    .filter(value => typeof value !== 'number')
    .map(x => x as keyof typeof PodcastServiceType)

  form: FormGroup<EditPodcastForm> | undefined;
  originalPodcast: Podcast | undefined;
  subjects: string[] = [];
  podcastId: string | undefined;

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<EditPodcastDialogComponent, any>,
    @Inject(MAT_DIALOG_DATA) public data: { podcastName: string },
    private dialog: MatDialog,
  ) {
    this.podcastName = data.podcastName;
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
      const episodeEndpoint = new URL(`/podcast/${encodeURIComponent(this.podcastName)}`, environment.api).toString();
      this.http.get<Podcast>(episodeEndpoint, { headers: headers })
        .subscribe(
          {
            next: resp => {
              this.podcastId = resp.id;
              this.originalPodcast = resp;
              this.form = new FormGroup<EditPodcastForm>({
                removed: new FormControl(resp.removed, { nonNullable: true }),
                indexAllEpisodes: new FormControl(resp.indexAllEpisodes, { nonNullable: true }),
                bypassShortEpisodeChecking: new FormControl(resp.bypassShortEpisodeChecking, { nonNullable: true }),
                releaseAuthority: new FormControl(resp.releaseAuthority ?? PodcastServiceType[PodcastServiceType.Unset], { nonNullable: true }),
                primaryPostService: new FormControl(resp.primaryPostService ?? PodcastServiceType[PodcastServiceType.Unset], { nonNullable: true }),
                spotifyId: new FormControl(resp.spotifyId, { nonNullable: true }),
                appleId: new FormControl(resp.appleId, { nonNullable: false }),
                youTubePublicationDelay: new FormControl(resp.youTubePublicationDelay, { nonNullable: true }),
                skipEnrichingFromYouTube: new FormControl(resp.skipEnrichingFromYouTube, { nonNullable: true }),
                twitterHandle: new FormControl(resp.twitterHandle, { nonNullable: true }),
                blueskyHandle: new FormControl(resp.blueskyHandle, { nonNullable: true }),
                titleRegex: new FormControl(resp.titleRegex, { nonNullable: true }),
                descriptionRegex: new FormControl(resp.descriptionRegex, { nonNullable: true }),
                episodeMatchRegex: new FormControl(resp.episodeMatchRegex, { nonNullable: true }),
                episodeIncludeTitleRegex: new FormControl(resp.episodeIncludeTitleRegex, { nonNullable: true }),
                defaultSubject: new FormControl(resp.defaultSubject, { nonNullable: false }),
                ignoreAllEpisodes: new FormControl(resp.ignoreAllEpisodes, { nonNullable: true }),
                youTubeChannelId: new FormControl(resp.youTubeChannelId, { nonNullable: true }),
                youTubePlaylistId: new FormControl(resp.youTubePlaylistId, { nonNullable: true }),
                ignoredAssociatedSubjects: new FormControl<string[]>(resp.ignoredAssociatedSubjects ?? [], { nonNullable: true }),
                ignoredSubjects: new FormControl<string[]>(resp.ignoredSubjects ?? [], { nonNullable: true })
              });
              const subjectsEndpoint = new URL("/subjects", environment.api).toString();
              this.http.get<Subject[]>(subjectsEndpoint, { headers: headers }).subscribe({
                next: d => {
                  let initial: string[] = [];
                  if (resp.defaultSubject != null) {
                    initial.push(resp.defaultSubject);
                  }
                  this.subjects = [...initial].concat(d.filter(x => resp.defaultSubject == null || resp.defaultSubject != x.name).map(x => x.name));
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
              if (e.status == 404) {
                this.notFound = true;
              } else if (e.status == 409) {
                this.conflict = true;
              }
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
      const update: Podcast = {
        removed: this.form!.controls.removed.value,
        indexAllEpisodes: this.form!.controls.indexAllEpisodes.value,
        bypassShortEpisodeChecking: this.form!.controls.bypassShortEpisodeChecking.value,
        releaseAuthority: this.form!.controls.releaseAuthority.value == PodcastServiceType[PodcastServiceType.Unset] ? undefined : this.form!.controls.releaseAuthority.value,
        primaryPostService: this.form!.controls.primaryPostService.value == PodcastServiceType[PodcastServiceType.Unset] ? undefined : this.form!.controls.primaryPostService.value,
        spotifyId: this.form!.controls.spotifyId.value,
        appleId: this.form!.controls.appleId.value,
        youTubePublicationDelay: this.form!.controls.youTubePublicationDelay.value,
        skipEnrichingFromYouTube: this.form!.controls.skipEnrichingFromYouTube.value,
        twitterHandle: this.form!.controls.twitterHandle.value,
        blueskyHandle: this.form!.controls.blueskyHandle.value,
        titleRegex: this.form!.controls.titleRegex.value,
        descriptionRegex: this.form!.controls.descriptionRegex.value,
        episodeMatchRegex: this.form!.controls.episodeMatchRegex.value,
        episodeIncludeTitleRegex: this.form!.controls.episodeIncludeTitleRegex.value,
        defaultSubject: this.form!.controls.defaultSubject.value,
        ignoreAllEpisodes: this.form!.controls.ignoreAllEpisodes.value,
        youTubeChannelId: this.form!.controls.youTubeChannelId.value,
        youTubePlaylistId: this.form!.controls.youTubePlaylistId.value,
        ignoredAssociatedSubjects: this.form!.controls.ignoredAssociatedSubjects.value,
        ignoredSubjects: this.form!.controls.ignoredSubjects.value
      };

      var changes = this.getChanges(this.originalPodcast!, update);
      if (Object.keys(changes).length == 0) {
        this.dialogRef.close({ noChange: true });
      } else {
        this.send(this.podcastId!, changes);
      }
    }
  }

  getChanges(prev: Podcast, now: Podcast): EditPodcastPost {
    var changes: EditPodcastPost = {};
    if (prev.removed != now.removed) changes.removed = now.removed;
    if (prev.indexAllEpisodes != now.indexAllEpisodes) changes.indexAllEpisodes = now.indexAllEpisodes;
    if (prev.bypassShortEpisodeChecking != now.bypassShortEpisodeChecking) changes.bypassShortEpisodeChecking = now.bypassShortEpisodeChecking;
    if (prev.releaseAuthority != now.releaseAuthority && now.releaseAuthority) changes.releaseAuthority = now.releaseAuthority;
    if (prev.releaseAuthority != now.releaseAuthority && now.releaseAuthority == undefined) changes.unsetReleaseAuthority = true;
    if (prev.primaryPostService != now.primaryPostService && now.primaryPostService) changes.primaryPostService = now.primaryPostService;
    if (prev.primaryPostService != now.primaryPostService && now.primaryPostService == undefined) changes.unsetPrimaryPostService = true;
    if (prev.spotifyId != now.spotifyId) changes.spotifyId = now.spotifyId;
    if (prev.removed != now.removed) changes.removed = now.removed;
    if (prev.appleId != now.appleId) {
      changes.appleId = now.appleId;
      if (now.appleId == null) {
        changes.nullAppleId = true;
      }
    }
    if (prev.youTubePublicationDelay != now.youTubePublicationDelay) changes.youTubePublicationDelay = now.youTubePublicationDelay;
    if (prev.skipEnrichingFromYouTube != now.skipEnrichingFromYouTube) changes.skipEnrichingFromYouTube = now.skipEnrichingFromYouTube;
    if (prev.twitterHandle != now.twitterHandle) changes.twitterHandle = now.twitterHandle;
    if (prev.blueskyHandle != now.blueskyHandle) changes.blueskyHandle = now.blueskyHandle;
    if (prev.titleRegex != now.titleRegex) changes.titleRegex = now.titleRegex;
    if (prev.descriptionRegex != now.descriptionRegex) changes.descriptionRegex = now.descriptionRegex;
    if (prev.episodeMatchRegex != now.episodeMatchRegex) changes.episodeMatchRegex = now.episodeMatchRegex;
    if (prev.episodeIncludeTitleRegex != now.episodeIncludeTitleRegex) changes.episodeIncludeTitleRegex = now.episodeIncludeTitleRegex;
    if (prev.defaultSubject != now.defaultSubject) changes.defaultSubject = now.defaultSubject;
    if (prev.ignoreAllEpisodes != now.ignoreAllEpisodes) changes.ignoreAllEpisodes = now.ignoreAllEpisodes;
    if (prev.youTubeChannelId != now.youTubeChannelId) changes.youTubeChannelId = now.youTubeChannelId;
    if (prev.youTubePlaylistId != now.youTubePlaylistId) changes.youTubePlaylistId = now.youTubePlaylistId;
    if ((prev.ignoredAssociatedSubjects ?? []).join("|") != (now.ignoredAssociatedSubjects ?? []).join("|")) changes.ignoredAssociatedSubjects = now.ignoredAssociatedSubjects;
    if ((prev.ignoredSubjects ?? []).join("|") != (now.ignoredSubjects ?? []).join("|")) changes.ignoredSubjects = now.ignoredSubjects;
    return changes;
  }

  send(id: string, changes: EditPodcastPost) {
    const dialogRef = this.dialog.open(EditPodcastSendComponent, { disableClose: true, autoFocus: true });
    dialogRef.componentInstance.submit(id, changes);
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        this.dialogRef.close({ updated: true });
      }
    });
  }
}
