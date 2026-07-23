import { Component, Inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { CdkTextareaAutosize, TextFieldModule } from '@angular/cdk/text-field';
import { MatInputModule } from '@angular/material/input';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, forkJoin, catchError, of, throwError } from 'rxjs';
import { environment } from './../../environments/environment';
import { ApiEpisode } from '../api-episode.interface';
import { Subject } from '../subject.interface';
import { Person } from '../person.interface';
import { PersonMatch } from '../person-match.interface';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { EpisodeForm } from '../episode-form.interface';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { EpisodePost } from '../episode-post.interface';
import { EditEpisodeSendComponent } from '../edit-episode-send/edit-episode-send.component';
import { MatExpansionModule } from '@angular/material/expansion';
import { EpisodeChangeResponse } from '../episode-change-response.interface';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { KeyValuePipe } from '@angular/common';
import subjectNamesConfig from '../hoisted-subject-names.json';
import { Podcast } from '../podcast.interface';
import { MatDividerModule } from '@angular/material/divider';
import { buildEpisodeLanguageOptions } from '../language-options.util';
import { EditPersonDialogComponent } from '../edit-person-dialog/edit-person-dialog.component';
import { comparePeopleBySortKey } from '../person-sort';
import { FeatureSwitch } from '../feature-switch.enum';
import { FeatureSwtichService } from '../feature-switch-service';
import {
  buildEpisodeForm,
  getEpisodeChanges,
  mergeEpisodeSubjects,
  noCompareFunction,
  personLabel,
  regroupGuests as regroupGuestsPure,
  regroupSubjects as regroupSubjectsPure
} from '../episode-form.util';

@Component({
  selector: 'app-edit-episode-dialog',
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
  templateUrl: './edit-episode-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './edit-episode-dialog.component.sass'
})
export class EditEpisodeDialogComponent {
  protected FeatureSwitch = FeatureSwitch;
  readonly hoistedSubjectNames: string[] = subjectNamesConfig.hostedSubjectNames;
  readonly enableDesktopSubjectTypingFilter: boolean = typeof window !== 'undefined'
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  protected readonly personLabel = personLabel;
  protected readonly noCompareFunction = noCompareFunction;

  episodeId: string;
  podcastIdentifier: string;
  readonly podcastName = signal<string>("");
  readonly isLoading = signal<boolean>(true);
  readonly isInError = signal<boolean>(false);
  subjects: string[] = [];
  allSubjects: string[] = [];
  readonly selectedSubjects = signal<string[]>([]);
  readonly hoistedSubjects = signal<string[]>([]);
  readonly otherSubjects = signal<string[]>([]);
  readonly subjectsFilterTerm = signal<string>('');
  allPeople: Person[] = [];
  readonly selectedGuests = signal<Person[]>([]);
  readonly otherPeople = signal<Person[]>([]);
  readonly guestsFilterTerm = signal<string>('');
  readonly guestSuggestions = signal<PersonMatch[]>([]);
  readonly languages = signal<{ [key: string]: string }>({});

  readonly form = signal<FormGroup<EpisodeForm> | undefined>(undefined);
  originalEpisode: ApiEpisode | undefined;
  podcastDefaultSubject: string | null = null;
  podcastId: string = "";

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<EditEpisodeDialogComponent, any>,
    @Inject(MAT_DIALOG_DATA) public data: { podcastIdentifier: string, episodeId: string },
    private dialog: MatDialog,
    protected featureSwtichService: FeatureSwtichService,
  ) {
    this.episodeId = data.episodeId;
    this.podcastIdentifier = data.podcastIdentifier;
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
      const episodeEndpoint = new URL(`/episode/${encodeURIComponent(this.podcastIdentifier)}/${this.episodeId}`, environment.api).toString();
      const subjectsEndpoint = new URL("/subjects", environment.api).toString();
      const peopleEndpoint = new URL("/people", environment.api).toString();
      const languagesEndpoint = new URL("/languages", environment.api).toString();

      var resp = await firstValueFrom(forkJoin(
        {
          episode: this.http.get<ApiEpisode>(episodeEndpoint, { headers: headers }),
          subjects: this.http.get<Subject[]>(subjectsEndpoint, { headers: headers }),
          people: this.http.get<Person[]>(peopleEndpoint, { headers: headers }).pipe(
            catchError(err => err?.status === 404 ? of([] as Person[]) : throwError(() => err))
          ),
          languages: this.http.get<{ [key: string]: string }>(languagesEndpoint, { headers: headers })
        }
      ));

      this.originalEpisode = resp.episode;

      const podcast = await this.getPodcast(headers, this.podcastIdentifier);
      if (!podcast) {
        this.isInError.set(true);
        return;
      }
      this.podcastDefaultSubject = podcast?.defaultSubject ?? null;
      this.podcastName.set(podcast.name!);
      this.podcastId = podcast.id!;

      this.form.set(buildEpisodeForm(resp.episode));
      this.allPeople = resp.people.sort(comparePeopleBySortKey);
      this.guestSuggestions.set(resp.episode.guestSuggestions ?? []);
      this.regroupGuests(resp.episode.guests ?? []);
      const { subjects, allSubjects } = mergeEpisodeSubjects(resp.episode.subjects, resp.subjects, this.podcastDefaultSubject);
      this.subjects = subjects;
      this.allSubjects = allSubjects;
      this.regroupSubjects(resp.episode.subjects);
      this.languages.set(buildEpisodeLanguageOptions(resp.languages));
      this.isLoading.set(false);
    } catch (e) {
      console.error(e);
      this.isLoading.set(false);
      this.isInError.set(true);
    }
  }

  close() {
    this.dialogRef.close({ closed: true });
  }

  onSubmit() {
    const form = this.form();
    if (form?.valid) {

      const update: ApiEpisode = {
        id: this.episodeId,
        title: form.controls.title.value,
        description: form.controls.description.value,
        posted: form.controls.posted.value,
        tweeted: form.controls.tweeted.value,
        bluesky: form.controls.blueskyPosted.value,
        ignored: form.controls.ignored.value,
        removed: form.controls.removed.value,
        explicit: form.controls.explicit.value,
        release: new Date(form.controls.release.value),
        duration: form.controls.duration.value,
        urls: {
        },
        images: {
          spotify: form.controls.spotifyImage.value,
          apple: form.controls.appleImage.value,
          youtube: form.controls.youtubeImage.value,
          other: form.controls.otherImage.value
        },
        subjects: form.controls.subjects.value,
        searchTerms: form.controls.searchTerms.value,
        lang: form.controls.lang.value,
        guests: form.controls.guests.value,
      };
      if (form.controls.spotify.value) {
        update.urls.spotify = new URL(form.controls.spotify.value);
      }
      if (form.controls.apple.value) {
        update.urls.apple = new URL(form.controls.apple.value);
      }
      if (form.controls.youtube.value) {
        update.urls.youtube = new URL(form.controls.youtube.value);
      }
      if (form.controls.bbc.value) {
        update.urls.bbc = new URL(form.controls.bbc.value);
      }
      if (form.controls.internetArchive.value) {
        update.urls.internetArchive = new URL(form.controls.internetArchive.value);
      }
      var changes = getEpisodeChanges(this.originalEpisode!, update);
      if (Object.keys(changes).length == 0) {
        this.dialogRef.close({ noChange: true, podcastId: this.podcastId });
      } else {
        this.send(this.originalEpisode?.podcastId!, this.episodeId, changes);
      }
    }
  }

  send(podcastId: string, episodeId: string, changes: EpisodePost) {
    const dialogRef = this.dialog.open<EditEpisodeSendComponent, any, { updated: boolean, response: EpisodeChangeResponse }>(EditEpisodeSendComponent, { disableClose: true, autoFocus: true });
    dialogRef.componentInstance.submit(podcastId, episodeId, changes);
    dialogRef.afterClosed().subscribe(async result => {
      if (result && result.updated) {
        if (result.response && (result.response.blueskyPostDeleted == false || !result.response.tweetDeleted == false)) {
          console.error("Failure to remove tweet/bluesky-post", result.response);
        }
        this.dialogRef.close({ updated: true, response: result.response, podcastId: podcastId });
      }
    });
  }

  onGuestsSelectionChange() {
    this.regroupGuests(this.form()?.controls.guests.value);
  }

  onGuestsDropdownOpenChange(opened: boolean) {
    if (!opened) {
      this.guestsFilterTerm.set('');
      this.regroupGuests(this.form()?.controls.guests.value);
    }
  }

  onGuestsDropdownKeydown(event: KeyboardEvent) {
    if (!this.enableDesktopSubjectTypingFilter) {
      return;
    }
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    if (event.key === 'Backspace') {
      const guestsFilterTerm = this.guestsFilterTerm();
      if (guestsFilterTerm.length > 0) {
        this.guestsFilterTerm.set(guestsFilterTerm.substring(0, guestsFilterTerm.length - 1));
        this.regroupGuests(this.form()?.controls.guests.value);
      }
      event.preventDefault();
      return;
    }

    if (event.key === 'Escape') {
      this.guestsFilterTerm.set('');
      this.regroupGuests(this.form()?.controls.guests.value);
      event.preventDefault();
      return;
    }

    if (event.key.length === 1) {
      this.guestsFilterTerm.set(this.guestsFilterTerm() + event.key);
      this.regroupGuests(this.form()?.controls.guests.value);
      event.preventDefault();
    }
  }

  regroupGuests(selected: string[] | null | undefined) {
    const { selectedGuests, otherPeople } = regroupGuestsPure(
      this.allPeople, this.originalEpisode?.guestPeople, selected, this.guestsFilterTerm()
    );
    this.selectedGuests.set(selectedGuests);
    this.otherPeople.set(otherPeople);
  }

  addSuggestedGuest(personName: string) {
    const current = this.form()?.controls.guests.value ?? [];
    if (current.includes(personName)) {
      return;
    }
    this.form()?.controls.guests.setValue([...current, personName]);
    this.guestSuggestions.set(this.guestSuggestions().filter(x => x.person.name !== personName));
    this.regroupGuests(this.form()?.controls.guests.value);
  }

  openAddPerson() {
    const dialogRef = this.dialog.open(EditPersonDialogComponent, {
      data: { create: true, personName: this.guestsFilterTerm() || undefined },
      disableClose: true,
      autoFocus: true,
      width: '90%'
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result?.updated && result.personName) {
        await this.refreshPeopleAndSelect(result.personName, result.person);
      }
    });
  }

  openEditPerson(person: Person) {
    const dialogRef = this.dialog.open(EditPersonDialogComponent, {
      data: { create: false, personName: person.name },
      disableClose: true,
      autoFocus: true,
      width: '90%'
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result?.updated) {
        await this.refreshPeopleAndSelect(person.name);
      }
    });
  }

  private async refreshPeopleAndSelect(personName: string, created?: Person) {
    try {
      const token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
        authorizationParams: {
          audience: `https://api.cultpodcasts.com/`,
          scope: 'curate'
        }
      }));
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + token);
      const peopleEndpoint = new URL("/people", environment.api).toString();
      const people = await firstValueFrom(
        this.http.get<Person[]>(peopleEndpoint, { headers: headers }).pipe(
          catchError(err => err?.status === 404 ? of([] as Person[]) : throwError(() => err))
        )
      );
      this.allPeople = people.sort(comparePeopleBySortKey);
      if (created && !this.allPeople.some(x => x.name === created.name)) {
        this.allPeople = [...this.allPeople, created].sort(comparePeopleBySortKey);
      }
    } catch {
      if (created) {
        this.allPeople = [...this.allPeople.filter(x => x.name !== created.name), created]
          .sort(comparePeopleBySortKey);
      }
    }

    const current = this.form()?.controls.guests.value ?? [];
    if (!current.includes(personName)) {
      this.form()?.controls.guests.setValue([...current, personName]);
    }
    this.regroupGuests(this.form()?.controls.guests.value);
  }

  onSubjectsDropdownOpenChange(opened: boolean) {
    if (!opened) {
      this.subjectsFilterTerm.set('');
      this.regroupSubjects(this.form()?.controls.subjects.value);
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
      const subjectsFilterTerm = this.subjectsFilterTerm();
      if (subjectsFilterTerm.length > 0) {
        this.subjectsFilterTerm.set(subjectsFilterTerm.substring(0, subjectsFilterTerm.length - 1));
        this.regroupSubjects(this.form()?.controls.subjects.value);
      }
      event.preventDefault();
      return;
    }

    if (event.key === 'Escape') {
      this.subjectsFilterTerm.set('');
      this.regroupSubjects(this.form()?.controls.subjects.value);
      event.preventDefault();
      return;
    }

    if (event.key.length === 1) {
      this.subjectsFilterTerm.set(this.subjectsFilterTerm() + event.key);
      this.regroupSubjects(this.form()?.controls.subjects.value);
      event.preventDefault();
    }
  }

  onSubjectsSelectionChange() {
    this.regroupSubjects(this.form()?.controls.subjects.value);
  }

  regroupSubjects(selected: string[] | null | undefined) {
    const { selectedSubjects, hoistedSubjects, otherSubjects } = regroupSubjectsPure(
      selected, this.allSubjects, this.podcastDefaultSubject, this.hoistedSubjectNames, this.subjectsFilterTerm()
    );
    this.selectedSubjects.set(selectedSubjects);
    this.hoistedSubjects.set(hoistedSubjects);
    this.otherSubjects.set(otherSubjects);
  }

  async getPodcast(headers: HttpHeaders, podcastIdentifier: string): Promise<Podcast | null> {
    if (!podcastIdentifier) {
      return null;
    }
    try {
      const podcastEndpoint = new URL(`/podcast/${podcastIdentifier}`, environment.api).toString();
      const podcast = await firstValueFrom(this.http.get<Podcast>(podcastEndpoint, { headers: headers }));
      return podcast;
    } catch {
      return null;
    }
  }
}
