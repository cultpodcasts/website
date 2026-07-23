import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Podcast } from '../podcast.interface';
import { firstValueFrom, forkJoin } from 'rxjs';
import { environment } from './../../environments/environment';
import { Subject } from '../subject.interface';
import { PodcastServiceType } from "../podcast-service-type.enum";
import { AddPodcastSendComponent } from '../add-podcast-send/add-podcast-send.component';
import { AddPodcastForm } from '../add-podcast-form.interface';
import { AddPodcastPost } from '../add-podcast-post.interface';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { KeyValuePipe } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { NamedRegexPreset } from '../regex-presets.interface';
import { RegexPresetsService } from '../regex-presets.service';
import { filterKeepingSelectedInOrder } from '../subject-filter.util';
import { buildPodcastLanguageOptions } from '../language-options.util';
import {
  buildPodcastFormControls,
  filterSubjectsByTerm,
  getPodcastChanges,
  noCompareFunction,
  asEmptyString,
  asStringArray
} from '../podcast-form.util';

@Component({
  selector: 'app-add-podcast-dialog-component',
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatCheckboxModule,
    KeyValuePipe,
    MatMenuModule,
    MatIconModule
  ],
  templateUrl: './add-podcast-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './add-podcast-dialog.component.sass'
})
export class AddPodcastDialogComponent {
  readonly enableDesktopSubjectTypingFilter: boolean = typeof window !== 'undefined'
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  protected readonly noCompareFunction = noCompareFunction;

  podcastName: string;
  isLoading: boolean = true;
  isInError: boolean = false;
  notFound: boolean = false;
  podcastServices = Object
    .values(PodcastServiceType)
    .filter(value => typeof value !== 'number')
    .map(x => x as keyof typeof PodcastServiceType)

  form: FormGroup<AddPodcastForm> | undefined;
  originalPodcast: Podcast | undefined;
  defaultSubjects: string[] = [];
  ignoredSubjects: string[] = [];
  defaultSubjectFilterTerm: string = '';
  ignoredSubjectsFilterTerm: string = '';
  languages: { [key: string]: string } = {};
  titleRegexPresets: NamedRegexPreset[] = [];
  descriptionRegexPresets: NamedRegexPreset[] = [];
  podcastId: string;
  highlightSubjectsTab: boolean = false;

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private regexPresetsService: RegexPresetsService,
    private dialogRef: MatDialogRef<AddPodcastDialogComponent, any>,
    @Inject(MAT_DIALOG_DATA) public data: {
      podcastName: string,
      defaultSubjectFromEpisode?: string,
      forceBypassShortEpisodeChecking?: boolean,
      podcastId: string,
      episodeId?: string,
      episodeLangUnset?: boolean
    },
    private dialog: MatDialog,
  ) {
    this.podcastName = data.podcastName;
    this.podcastId = data.podcastId;
  }

  async ngOnInit(): Promise<any> {
    await this.loadRegexPresets();
    var token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));
    try {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + token);
      const podcastEndpoint = new URL(`/podcast/${this.podcastId}`, environment.api).toString();
      const subjectsEndpoint = new URL("/subjects", environment.api).toString();
      const languagesEndpoint = new URL("/languages", environment.api).toString();

      var resp = await firstValueFrom(forkJoin(
        {
          podcast: this.http.get<Podcast>(podcastEndpoint, { headers: headers, observe: "response" }),
          subjects: this.http.get<Subject[]>(subjectsEndpoint, { headers: headers }),
          languages: this.http.get<{ [key: string]: string }>(languagesEndpoint, { headers: headers })
        }
      ));
      if (resp.podcast.status == 200 && resp.podcast.body) {
        this.originalPodcast = resp.podcast.body;
        this.form = new FormGroup<AddPodcastForm>({
          podcastName: new FormControl(this.podcastName, { nonNullable: true }),
          ...buildPodcastFormControls(resp.podcast.body)
        });
        if (this.data.forceBypassShortEpisodeChecking) {
          this.form.controls.bypassShortEpisodeChecking.setValue(true);
        }

        const desiredDefaultSubject = this.data.defaultSubjectFromEpisode ?? resp.podcast.body.defaultSubject;
        if (desiredDefaultSubject != null) {
          this.form.controls.defaultSubject.setValue(desiredDefaultSubject);
        }
        this.highlightSubjectsTab = this.data.defaultSubjectFromEpisode != null
          && desiredDefaultSubject != null
          && desiredDefaultSubject !== '';

        let initial: string[] = [];
        if (desiredDefaultSubject != null) {
          initial.push(desiredDefaultSubject);
        }
        this.defaultSubjects = [...initial].concat(resp.subjects.filter(x => desiredDefaultSubject == null || desiredDefaultSubject != x.name).map(x => x.name));
        const ignoredSubjects = resp.podcast.body.ignoredSubjects ?? [];
        this.ignoredSubjects = ignoredSubjects.concat(resp.subjects.filter(x => !ignoredSubjects.includes(x.name)).map(x => x.name));
        this.languages = buildPodcastLanguageOptions(resp.languages);
        this.isLoading = false;
      } else {
        this.isLoading = false;
        this.isInError = true;
        if (resp.podcast.status == 404) {
          this.notFound = true;
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

  async loadRegexPresets(): Promise<void> {
    const presets = this.regexPresetsService.loadRegexPresets();
    this.titleRegexPresets = presets.title;
    this.descriptionRegexPresets = presets.description;
  }

  applyTitleRegexPreset(pattern: string): void {
    if (!this.form) {
      return;
    }

    this.regexPresetsService.applyTitleRegexPreset(
      pattern,
      this.form.controls.titleRegex,
      this.form.controls.podcastName.value ?? this.podcastName,
    );
  }

  applyDescriptionRegexPreset(pattern: string): void {
    if (!this.form) {
      return;
    }

    this.regexPresetsService.applyDescriptionRegexPreset(
      pattern,
      this.form.controls.descriptionRegex,
      this.form.controls.podcastName.value ?? this.podcastName,
    );
  }

  onSubmit() {
    if (this.form?.valid) {
      const update: Podcast = {
        name: this.form!.controls.podcastName.value,
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
        ignoredAssociatedSubjects: asStringArray(this.form!.controls.ignoredAssociatedSubjects.value),
        ignoredSubjects: asStringArray(this.form!.controls.ignoredSubjects.value),
        lang: this.form!.controls.lang.value,
        knownTerms: asStringArray(this.form!.controls.knownTerms.value),
        minimumDuration: asEmptyString(this.form!.controls.minimumDuration.value),
        enrichmentHashTags: asStringArray(this.form!.controls.enrichmentHashTags.value),
        hashTag: asEmptyString(this.form!.controls.hashTag.value),
      };

      var changes = this.getChanges(this.originalPodcast!, update);
      if (Object.keys(changes).length == 0) {
        this.dialogRef.close({ noChange: true });
      } else {
        this.send(this.podcastId!, changes);
      }
    }
  }

  getChanges(prev: Podcast, now: Podcast): AddPodcastPost {
    const changes: AddPodcastPost = getPodcastChanges(prev, now);
    if (prev.name != now.name) changes.podcastName = now.name;
    return changes;
  }

  send(podcastId: string, changes: AddPodcastPost) {
    const dialogRef = this.dialog.open(AddPodcastSendComponent, { disableClose: true, autoFocus: true });
    dialogRef.componentInstance.submit(podcastId, changes);
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        await this.applyEpisodeLanguageFromPodcast(podcastId, changes);
        this.dialogRef.close({ updated: true, response: result.response });
      }
    });
  }

  private async applyEpisodeLanguageFromPodcast(podcastId: string, changes: AddPodcastPost) {
    if (!this.data.episodeLangUnset || !this.data.episodeId) {
      return;
    }

    const podcastLang = changes.lang;
    if (!podcastLang || podcastLang === 'unset') {
      return;
    }

    try {
      const token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
        authorizationParams: {
          audience: `https://api.cultpodcasts.com/`,
          scope: 'curate'
        }
      }));
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set('Authorization', 'Bearer ' + token);
      const episodeEndpoint = new URL(`/episode/${podcastId}/${this.data.episodeId}`, environment.api).toString();
      await firstValueFrom(this.http.post(episodeEndpoint, { lang: podcastLang }, { headers }));
    } catch (error) {
      console.error('Failed to apply podcast default language to episode.', error);
    }
  }
  onDefaultSubjectDropdownOpenChange(opened: boolean) {
    if (!opened) {
      this.defaultSubjectFilterTerm = '';
    }
  }

  onIgnoredSubjectsDropdownOpenChange(opened: boolean) {
    if (!opened) {
      this.ignoredSubjectsFilterTerm = '';
    }
  }

  onDefaultSubjectDropdownKeydown(event: KeyboardEvent) {
    this.applyFilterKey(event, 'defaultSubjectFilterTerm');
  }

  onIgnoredSubjectsDropdownKeydown(event: KeyboardEvent) {
    this.applyFilterKey(event, 'ignoredSubjectsFilterTerm');
  }

  onTabChange(selectedIndex: number) {
    if (selectedIndex === 2) {
      this.highlightSubjectsTab = false;
    }
  }

  filteredDefaultSubjects() {
    return filterSubjectsByTerm(this.defaultSubjects, this.defaultSubjectFilterTerm);
  }

  filteredIgnoredSubjects() {
    const selected = this.form?.controls.ignoredSubjects.value ?? [];
    const selectedSet = new Set(selected);
    return filterKeepingSelectedInOrder(this.ignoredSubjects, this.ignoredSubjectsFilterTerm, selectedSet);
  }

  applyFilterKey(event: KeyboardEvent, key: 'defaultSubjectFilterTerm' | 'ignoredSubjectsFilterTerm') {
    if (!this.enableDesktopSubjectTypingFilter) {
      return;
    }
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    if (event.key === 'Backspace') {
      if (this[key].length > 0) {
        this[key] = this[key].substring(0, this[key].length - 1);
      }
      event.preventDefault();
      return;
    }

    if (event.key === 'Escape') {
      this[key] = '';
      event.preventDefault();
      return;
    }

    if (event.key.length === 1) {
      this[key] += event.key;
      event.preventDefault();
    }
  }

}
