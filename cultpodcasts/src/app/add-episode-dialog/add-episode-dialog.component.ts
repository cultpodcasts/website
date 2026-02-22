import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, forkJoin } from 'rxjs';
import { environment } from './../../environments/environment';
import { ApiEpisode } from '../api-episode.interface';
import { Subject } from '../subject.interface';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { EpisodeForm } from '../episode-form.interface';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { EpisodePost } from '../episode-post.interface';
import { AddEpisodeSendComponent } from '../add-episode-send/add-episode-send.component';
import { MatExpansionModule } from '@angular/material/expansion';
import { CdkTextareaAutosize, TextFieldModule } from '@angular/cdk/text-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { KeyValuePipe } from '@angular/common';
import subjectNamesConfig from '../hoisted-subject-names.json';
import { Podcast } from '../podcast.interface';
import { MatDividerModule } from '@angular/material/divider';
import { filterKeepingSelectedInOrder } from '../subject-filter.util';

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
    MatExpansionModule,
    CdkTextareaAutosize,
    TextFieldModule,
    MatInputModule,
    MatCheckboxModule,
    KeyValuePipe,
    MatDividerModule
  ],
  templateUrl: './add-episode-dialog.component.html',
  styleUrl: './add-episode-dialog.component.sass'
})
export class AddEpisodeDialogComponent {
  readonly hoistedSubjectNames: string[] = subjectNamesConfig.hostedSubjectNames;
  readonly enableDesktopSubjectTypingFilter: boolean = typeof window !== 'undefined'
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  episodeId: string;
  isNewPodcast: boolean;
  isLoading: boolean = true;
  isInError: boolean = false;
  subjects: string[] = [];
  allSubjects: string[] = [];
  selectedSubjects: string[] = [];
  hoistedSubjects: string[] = [];
  otherSubjects: string[] = [];
  subjectsFilterTerm: string = '';
  languages: { [key: string]: string } = {};

  form: FormGroup<EpisodeForm> | undefined;
  originalEpisode: ApiEpisode | undefined;
  podcastName: string | undefined;
  podcastDefaultSubject: string | null = null;

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
      const episodeEndpoint = new URL(`/episode/${this.episodeId}`, environment.api).toString();

      const subjectsEndpoint = new URL("/subjects", environment.api).toString();
      const languagesEndpoint = new URL("/languages", environment.api).toString();

      var resp = await firstValueFrom(forkJoin(
        {
          episode: this.http.get<ApiEpisode>(episodeEndpoint, { headers: headers }),
          subjects: this.http.get<Subject[]>(subjectsEndpoint, { headers: headers }),
          languages: this.http.get<{ [key: string]: string }>(languagesEndpoint, { headers: headers })
        }
      ));

      this.originalEpisode = resp.episode;
      this.podcastName = resp.episode.podcastName;
      this.podcastDefaultSubject = await this.getPodcastDefaultSubject(headers, this.podcastName);
      this.form = new FormGroup<EpisodeForm>({
        title: new FormControl(resp.episode.title, { nonNullable: true }),
        description: new FormControl(resp.episode.description, { nonNullable: true }),
        posted: new FormControl(resp.episode.posted, { nonNullable: true }),
        tweeted: new FormControl(resp.episode.tweeted, { nonNullable: true }),
        blueskyPosted: new FormControl(resp.episode.bluesky ?? false, { nonNullable: true }),
        ignored: new FormControl(resp.episode.ignored, { nonNullable: true }),
        explicit: new FormControl(resp.episode.explicit, { nonNullable: true }),
        removed: new FormControl(resp.episode.removed, { nonNullable: true }),
        release: new FormControl(this.dateToLocalISO(resp.episode.release), { nonNullable: true }),
        duration: new FormControl(resp.episode.duration, { nonNullable: true }),
        spotify: new FormControl(resp.episode.urls.spotify || null),
        spotifyImage: new FormControl(resp.episode.images?.spotify || null),
        apple: new FormControl(resp.episode.urls.apple || null),
        appleImage: new FormControl(resp.episode.images?.apple || null),
        youtube: new FormControl(resp.episode.urls.youtube || null),
        youtubeImage: new FormControl(resp.episode.images?.youtube || null),
        otherImage: new FormControl(resp.episode.images?.other || null),
        bbc: new FormControl(resp.episode.urls.bbc || null),
        internetArchive: new FormControl(resp.episode.urls.internetArchive || null),
        subjects: new FormControl(resp.episode.subjects, { nonNullable: true }),
        searchTerms: new FormControl(resp.episode.searchTerms || null),
        lang: new FormControl(resp.episode.lang || null),
        twitterHandles: new FormControl<string[]>(resp.episode.twitterHandles ?? [], { nonNullable: true }),
        blueskyHandles: new FormControl<string[]>(resp.episode.blueskyHandles ?? [], { nonNullable: true })
      });
      this.subjects = resp.episode.subjects.concat(resp.subjects.filter(x => !resp.episode.subjects.includes(x.name)).map(x => x.name));
      this.allSubjects = this.unique(this.subjects.concat(this.podcastDefaultSubject ? [this.podcastDefaultSubject] : []));
      this.regroupSubjects(resp.episode.subjects);
      this.languages = { ...{ "unset": "No Language" }, ...resp.languages };
      this.isLoading = false;
    } catch (e) {
      console.error(e);
      this.isLoading = false;
      this.isInError = true;
    }
  }

  close() {
    this.dialogRef.close({
      closed: true,
      isNewPodcast: this.isNewPodcast,
      podcastName: this.podcastName,
      ...this.getNewPodcastDialogDefaults()
    });
  }

  onSubmit() {
    if (this.form?.valid) {

      const update: ApiEpisode = {
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
        urls: {},
        images: {
          spotify: this.form!.controls.spotifyImage.value,
          apple: this.form!.controls.appleImage.value,
          youtube: this.form!.controls.youtubeImage.value,
          other: this.form!.controls.otherImage.value
        },
        subjects: this.form!.controls.subjects.value,
        searchTerms: this.form!.controls.searchTerms.value,
        lang: this.form!.controls.lang.value || "unset",
        twitterHandles: this.translateForEntityA(this.form!.controls.twitterHandles),
        blueskyHandles: this.translateForEntityA(this.form!.controls.blueskyHandles)
      };
      if (this.form!.controls.spotify.value) {
        update.urls.spotify = new URL(this.form!.controls.spotify.value);
      }
      if (this.form!.controls.apple.value) {
        update.urls.apple = new URL(this.form!.controls.apple.value);
      }
      if (this.form!.controls.youtube.value) {
        update.urls.youtube = new URL(this.form!.controls.youtube.value);
      }
      if (this.form!.controls.bbc.value) {
        update.urls.bbc = new URL(this.form!.controls.bbc.value);
      }
      if (this.form!.controls.internetArchive.value) {
        update.urls.internetArchive = new URL(this.form!.controls.internetArchive.value);
      }

      var changes = this.getChanges(this.originalEpisode!, update);
      if (Object.keys(changes).length == 0) {
        this.dialogRef.close({
          noChange: true,
          isNewPodcast: this.isNewPodcast,
          podcastName: this.podcastName,
          ...this.getNewPodcastDialogDefaults()
        });
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
        this.dialogRef.close({
          updated: true,
          isNewPodcast: this.isNewPodcast,
          podcastName: this.podcastName,
          ...this.getNewPodcastDialogDefaults()
        });
      }
    });
  }

  getNewPodcastDialogDefaults() {
    if (!this.isNewPodcast) {
      return {};
    }

    const selectedSubjects = this.form?.controls.subjects.value ?? [];
    const defaultSubjectFromEpisode = selectedSubjects.length > 0 ? selectedSubjects[0] : undefined;
    const forceBypassShortEpisodeChecking = this.originalEpisode?.ignored === true
      && this.form?.controls.ignored.value === false;

    return {
      defaultSubjectFromEpisode,
      forceBypassShortEpisodeChecking
    };
  }

  getChanges(prev: ApiEpisode, now: ApiEpisode): EpisodePost {
    const nowReleaseDate = new Date(now.release).toISOString();
    var changes: EpisodePost = {};
    if (prev.description != now.description) changes.description = now.description;
    if (prev.duration != now.duration) changes.duration = now.duration;
    if (prev.explicit != now.explicit) changes.explicit = now.explicit;
    if (prev.ignored != now.ignored) changes.ignored = now.ignored;
    if (prev.posted != now.posted) changes.posted = now.posted;
    if (prev.tweeted != now.tweeted) changes.tweeted = now.tweeted;
    if ((prev.bluesky ?? false) != (now.bluesky ?? false)) changes.bluesky = now.bluesky ?? false;
    if (prev.release.toISOString() != nowReleaseDate) changes.release = nowReleaseDate;
    if (prev.removed != now.removed) changes.removed = now.removed;
    if (prev.searchTerms != now.searchTerms) changes.searchTerms = now.searchTerms;
    if (!this.isSameA(prev.subjects, now.subjects)) changes.subjects = now.subjects;
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
    if (!this.areEqual(prev.lang ?? "unset", now.lang ?? "unset")) changes.lang = now.lang == "unset" ? "" : now.lang ?? "";
    if (!this.isSameA(prev.twitterHandles, now.twitterHandles)) changes.twitterHandles = now.twitterHandles;
    if (!this.isSameA(prev.blueskyHandles, now.blueskyHandles)) changes.blueskyHandles = now.blueskyHandles;
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

  dateToLocalISO(date: Date) {
    const off = date.getTimezoneOffset()
    const absoff = Math.abs(off)
    return (new Date(date.getTime() - off * 60 * 1000).toISOString().substring(0, 23))
  }

  noCompareFunction() {
    return 0;
  }

  onSubjectsDropdownOpenChange(opened: boolean) {
    if (!opened) {
      this.subjectsFilterTerm = '';
      this.regroupSubjects(this.form?.controls.subjects.value);
    }
  }

  onSubjectsDropdownKeydown(event: KeyboardEvent) {
    if (!this.enableDesktopSubjectTypingFilter) {
      return;
    }
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    if (event.key === 'Backspace') {
      if (this.subjectsFilterTerm.length > 0) {
        this.subjectsFilterTerm = this.subjectsFilterTerm.substring(0, this.subjectsFilterTerm.length - 1);
        this.regroupSubjects(this.form?.controls.subjects.value);
      }
      event.preventDefault();
      return;
    }

    if (event.key === 'Escape') {
      this.subjectsFilterTerm = '';
      this.regroupSubjects(this.form?.controls.subjects.value);
      event.preventDefault();
      return;
    }

    if (event.key.length === 1) {
      this.subjectsFilterTerm += event.key;
      this.regroupSubjects(this.form?.controls.subjects.value);
      event.preventDefault();
    }
  }

  onSubjectsSelectionChange() {
    this.regroupSubjects(this.form?.controls.subjects.value);
  }

  regroupSubjects(selected: string[] | null | undefined) {
    const selectedSet = new Set(this.unique(selected ?? []));
    this.selectedSubjects = [];

    this.hoistedSubjects = [];
    if (this.podcastDefaultSubject) {
      this.hoistedSubjects.push(this.podcastDefaultSubject);
    }

    const orderedHoistedNames = this.unique([
      ...this.hoistedSubjectNames
    ]);

    const remainingHoistedSubjects = orderedHoistedNames.filter(subject =>
      this.allSubjects.includes(subject)
      && subject !== this.podcastDefaultSubject
    );
    this.hoistedSubjects = this.hoistedSubjects.concat(remainingHoistedSubjects);

    const hoistedSet = new Set(this.hoistedSubjects);
    this.otherSubjects = this.allSubjects.filter(subject => !hoistedSet.has(subject));

    this.hoistedSubjects = this.filterSubjectsByTerm(this.hoistedSubjects, selectedSet);
    this.otherSubjects = this.filterSubjectsByTerm(this.otherSubjects, selectedSet);
  }

  filterSubjectsByTerm(subjects: string[], selectedSet: Set<string>): string[] {
    return filterKeepingSelectedInOrder(subjects, this.subjectsFilterTerm, selectedSet);
  }

  async getPodcastDefaultSubject(headers: HttpHeaders, podcastName: string | undefined): Promise<string | null> {
    if (!podcastName) {
      return null;
    }
    try {
      const podcastEndpoint = new URL(`/podcast/${encodeURIComponent(podcastName)}`, environment.api).toString();
      const podcast = await firstValueFrom(this.http.get<Podcast>(podcastEndpoint, { headers: headers }));
      return podcast.defaultSubject ?? null;
    } catch {
      return null;
    }
  }

  unique(values: string[]) {
    return [...new Set(values)];
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
}
