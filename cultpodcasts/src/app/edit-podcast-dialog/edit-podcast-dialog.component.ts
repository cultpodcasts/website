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
import { firstValueFrom, forkJoin } from 'rxjs';
import { environment } from './../../environments/environment';
import { Subject } from '../subject.interface';
import { EditPodcastPost } from "../edit-podcast-post.interface";
import { EditPodcastSendComponent } from '../edit-podcast-send/edit-podcast-send.component';
import { PodcastServiceType } from "../podcast-service-type.enum";
import { MatInputModule } from '@angular/material/input';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { KeyValuePipe } from '@angular/common';

@Component({
  selector: 'app-edit-podcast-dialog-component',
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    TextFieldModule,
    MatCheckboxModule,
    KeyValuePipe
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
  defaultSubjects: string[] = [];
  ignoredSubjects: string[] = [];
  languages: { [key: string]: string } = {};
  podcastId: string | undefined;
  episodeId: string | undefined;

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<EditPodcastDialogComponent, any>,
    @Inject(MAT_DIALOG_DATA) public data: { podcastName: string, episodeId: string | undefined },
    private dialog: MatDialog,
  ) {
    this.podcastName = data.podcastName;
    this.episodeId = data.episodeId;
  }

  async ngOnInit(): Promise<any> {
    var token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));
    try {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + token);
      let episodeEndpoint: string;
      if (this.episodeId) {
        episodeEndpoint = new URL(`/podcast/${encodeURIComponent(this.podcastName)}/${this.episodeId}`, environment.api).toString();
      } else {
        episodeEndpoint = new URL(`/podcast/${encodeURIComponent(this.podcastName)}`, environment.api).toString();
      }
      const subjectsEndpoint = new URL("/subjects", environment.api).toString();
      const languagesEndpoint = new URL("/languages", environment.api).toString();

      var resp = await firstValueFrom(forkJoin(
        {
          podcast: this.http.get<Podcast>(episodeEndpoint, { headers: headers, observe: "response" }),
          subjects: this.http.get<Subject[]>(subjectsEndpoint, { headers: headers }),
          languages: this.http.get<{ [key: string]: string }>(languagesEndpoint, { headers: headers })
        }
      ));

      if (resp.podcast.status == 200 && resp.podcast.body) {
        this.podcastId = resp.podcast.body.id;
        this.originalPodcast = resp.podcast.body;
        this.form = new FormGroup<EditPodcastForm>({
          removed: new FormControl(resp.podcast.body.removed, { nonNullable: true }),
          indexAllEpisodes: new FormControl(resp.podcast.body.indexAllEpisodes, { nonNullable: true }),
          bypassShortEpisodeChecking: new FormControl(resp.podcast.body.bypassShortEpisodeChecking, { nonNullable: true }),
          releaseAuthority: new FormControl(resp.podcast.body.releaseAuthority ?? PodcastServiceType[PodcastServiceType.Unset], { nonNullable: true }),
          primaryPostService: new FormControl(resp.podcast.body.primaryPostService ?? PodcastServiceType[PodcastServiceType.Unset], { nonNullable: true }),
          spotifyId: new FormControl(resp.podcast.body.spotifyId, { nonNullable: true }),
          appleId: new FormControl(resp.podcast.body.appleId, { nonNullable: false }),
          youTubePublicationDelay: new FormControl(resp.podcast.body.youTubePublicationDelay, { nonNullable: true }),
          skipEnrichingFromYouTube: new FormControl(resp.podcast.body.skipEnrichingFromYouTube, { nonNullable: true }),
          twitterHandle: new FormControl(resp.podcast.body.twitterHandle, { nonNullable: true }),
          blueskyHandle: new FormControl(resp.podcast.body.blueskyHandle, { nonNullable: true }),
          titleRegex: new FormControl(resp.podcast.body.titleRegex, { nonNullable: true }),
          descriptionRegex: new FormControl(resp.podcast.body.descriptionRegex, { nonNullable: true }),
          episodeMatchRegex: new FormControl(resp.podcast.body.episodeMatchRegex, { nonNullable: true }),
          episodeIncludeTitleRegex: new FormControl(resp.podcast.body.episodeIncludeTitleRegex, { nonNullable: true }),
          defaultSubject: new FormControl(resp.podcast.body.defaultSubject, { nonNullable: false }),
          ignoreAllEpisodes: new FormControl(resp.podcast.body.ignoreAllEpisodes, { nonNullable: true }),
          youTubeChannelId: new FormControl(resp.podcast.body.youTubeChannelId, { nonNullable: true }),
          youTubePlaylistId: new FormControl(resp.podcast.body.youTubePlaylistId, { nonNullable: true }),
          ignoredAssociatedSubjects: new FormControl<string[]>(resp.podcast.body.ignoredAssociatedSubjects ?? [], { nonNullable: true }),
          ignoredSubjects: new FormControl<string[]>(resp.podcast.body.ignoredSubjects ?? [], { nonNullable: true }),
          lang: new FormControl(resp.podcast.body.lang || null),
          knownTerms: new FormControl<string[]>(resp.podcast.body.knownTerms ?? [], { nonNullable: true })
        });
        let initial: string[] = [];
        if (resp.podcast.body && resp.podcast.body.defaultSubject != null) {
          initial.push(resp.podcast.body.defaultSubject);
        }
        this.defaultSubjects = [...initial].concat(resp.subjects.filter(x => resp.podcast.body!.defaultSubject == null || resp.podcast.body!.defaultSubject != x.name).map(x => x.name));
        const ignoredSubjects = resp.podcast.body.ignoredSubjects ?? [];
        this.ignoredSubjects = ignoredSubjects.concat(resp.subjects.filter(x => !ignoredSubjects.includes(x.name)).map(x => x.name));
        this.languages= resp.languages;

        this.isLoading = false;
      } else {
        this.isLoading = false;
        this.isInError = true;
        if (resp.podcast.status == 404) {
          this.notFound = true;
        } else if (resp.podcast.status == 409) {
          this.conflict = true;
        }
      }
    } catch (e) {
      console.error(e);
      this.isLoading = false;
      this.isInError = true;
    }
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
        ignoredAssociatedSubjects: this.translateForEntityA(this.form!.controls.ignoredAssociatedSubjects),
        ignoredSubjects: this.translateForEntityA(this.form!.controls.ignoredSubjects),
        lang: this.form!.controls.lang.value,
        knownTerms: this.translateForEntityA(this.form!.controls.knownTerms)
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
    if (prev.defaultSubject != now.defaultSubject) changes.defaultSubject = now.defaultSubject ?? "";
    if (prev.ignoreAllEpisodes != now.ignoreAllEpisodes) changes.ignoreAllEpisodes = now.ignoreAllEpisodes;
    if (prev.youTubePlaylistId != now.youTubePlaylistId) changes.youTubePlaylistId = now.youTubePlaylistId;
    if (!this.isSameA(prev.ignoredAssociatedSubjects, now.ignoredAssociatedSubjects)) changes.ignoredAssociatedSubjects = now.ignoredAssociatedSubjects;
    if (!this.isSameA(prev.ignoredSubjects, now.ignoredSubjects)) changes.ignoredSubjects = now.ignoredSubjects;
    if ((prev.lang ?? "") != (now.lang ?? "")) changes.lang = now.lang ?? "";
    if (!this.isSameA(prev.knownTerms, now.knownTerms)) changes.knownTerms = now.knownTerms;
    return changes;
  }

  isSameA(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
    if (!a && !b) {
      return true;
    }
    if (!a && b?.length == 0) {
      return true;
    }
    if (a?.length == 0 && !b) {
      return true;
    }
    return JSON.stringify(a) == JSON.stringify(b);
  }

  translateForEntityA(x: FormControl<string[] | undefined | null>): string[] | undefined {
    if (x.value) {
      const valueS: any = x.value;
      if (valueS.push) {
        return x.value;
      } else if (valueS.split) {
        const valueSt: string = valueS;
        return valueSt.split(",");
      }
    };
    return [];
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

  noCompareFunction() {
    return 0;
  }
}
