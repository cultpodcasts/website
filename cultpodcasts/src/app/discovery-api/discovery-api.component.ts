import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, PLATFORM_ID, ViewChild, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { Subject, firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';
import { DiscoveryResults } from '../discovery-results.interface';
import { DiscoveryResult } from "../discovery-result.interface";
import { MatDialog } from '@angular/material/dialog';
import { DiscoverySubmitComponent } from '../discovery-submit/discovery-submit.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfirmComponent } from '../confirm/confirm.component';
import { SubmitDiscoveryState } from '../submit-discovery-state.interface';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { DiscoveryItemComponent } from '../discovery-item/discovery-item.component';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { SiteService } from '../site.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DiscoveryAwaitingReview } from '../discovery-supervision/discovery-supervision.models';
import { DiscoverySubmissionsService } from '../discovery-supervision/discovery-submissions.service';
import { ADMIN_ROLE, canSeeSubmissions, describeSubmissionError, isSupervisorRole } from '../discovery-supervision/discovery-supervision';
import { banFailureMessage, BannedChannel, matchesBannedChannel, saveResultIds } from '../discovery-ban';
import { DiscoveryBanService } from '../discovery-ban.service';
import {
  armCuratorSnapAfterScroll,
  observeCuratorSnapToolbar,
  syncCuratorSnapOffset,
  toggleCuratorSnapClass
} from '../curator-snap';

const likelyMatchThreshold = 0.5;
const autoHiddenThreshold = 0.05;

@Component({
  selector: 'app-discovery-api',
  imports: [
    MatProgressBarModule,
    DiscoveryItemComponent,
    MatButtonToggleModule,
    MatButtonModule,
    MatBadgeModule,
    DatePipe,
    RouterLink
  ],
  templateUrl: './discovery-api.component.html',
  styleUrl: './discovery-api.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DiscoveryApiComponent implements AfterViewInit {
  @ViewChild('curatorToolbar', { static: false }) curatorToolbar: ElementRef<HTMLElement> | undefined;

  results = signal<DiscoveryResult[] | undefined>(undefined);
  documentIds = signal<string[]>([]);
  selectedIds = signal<string[]>([]);
  /** Channels banned in this visit. A later load, including Hidden, is filtered with the same identity. */
  private readonly bannedChannels = signal<BannedChannel[]>([]);
  hiddenCount = signal<number>(0);
  includeHidden = signal<boolean>(false);
  isLoading = signal<boolean>(true);
  minDate = signal<Date | undefined>(undefined);
  saveDisabled = signal<boolean>(true);
  closeDisabled = signal<boolean>(false);
  displaySave = signal<boolean>(false);
  submitted = signal<boolean>(false);
  submittedSubject: Subject<boolean> = new Subject<boolean>();
  resultsFilterSubject: Subject<string> = new Subject<string>();
  erroredSubject: Subject<string[]> = new Subject<string[]>();
  resultsFilter = signal<string>("all");
  isInError = signal<boolean>(false);
  /** Reports held for supervisor review — not curatable here. */
  awaitingReview = signal<DiscoveryAwaitingReview[]>([]);
  releasingReportId = signal<string | null>(null);

  private readonly submissions = inject(DiscoverySubmissionsService);
  private readonly banService = inject(DiscoveryBanService);
  protected readonly roles = toSignal(inject(AuthServiceWrapper).roles, { initialValue: [] as string[] });
  protected readonly isAdmin = () => this.roles().includes(ADMIN_ROLE);
  protected readonly isSupervisor = () => isSupervisorRole(this.roles());
  protected readonly canSeeSubmissions = () => canSeeSubmissions(this.roles());

  private destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private snapOffsetObserver: ResizeObserver | undefined;

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router,
    private siteService: SiteService
  ) {
    this.destroyRef.onDestroy(() => {
      this.snapOffsetObserver?.disconnect();
      this.snapOffsetObserver = undefined;
      toggleCuratorSnapClass(false);
    });
  }

  ngOnInit() {
    this.siteService.setQuery(null);
    this.siteService.setPodcast(null);
    this.siteService.setSubject(null);

    // FakeAuth on the server cannot mint a curate token — wait for the browser.
    if (isPlatformBrowser(this.platformId)) {
      this.loadResults(false);
    }
  }

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.snapOffsetObserver = observeCuratorSnapToolbar(this.curatorToolbar?.nativeElement);
    armCuratorSnapAfterScroll(this.destroyRef, () => {
      syncCuratorSnapOffset(this.curatorToolbar?.nativeElement);
    });
  }

  loadResults(includeHidden: boolean) {
    this.isLoading.set(true);
    this.isInError.set(false);
    this.includeHidden.set(includeHidden);

    const token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));

    token.then(_token => {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + _token);
      const endpoint = new URL("/discovery-curation", environment.api);
      if (includeHidden) {
        endpoint.searchParams.set("includeHidden", "true");
      }
      this.http.get<DiscoveryResults>(endpoint.toString(), { headers: headers })
        .subscribe({
          next: resp => {
            this.isInError.set(false);
            this.results.set(resp.results.map(x => this.normalizeResult(x)));
            this.dropBannedSelections();
            this.documentIds.set(resp.ids);
            this.hiddenCount.set(resp.hiddenCount ?? 0);
            this.awaitingReview.set(resp.awaitingReview ?? []);
            const dates = resp.results.map(x => x.released).filter(x => x.getTime).map(x => x.getTime());
            if (dates.length > 0) {
              this.minDate.set(new Date(Math.min(...dates)));
            }
            this.isLoading.set(false);
            this.displaySave.set(this.hasQueueItems());
            this.resultsFilterSubject.next(this.resultsFilter());
          },
          error: () => {
            this.isLoading.set(false);
            this.isInError.set(true);
          }
        });
    }).catch(() => {
      this.isLoading.set(false);
      this.isInError.set(true);
    });
  }

  visibleResults(): DiscoveryResult[] {
    return this.results()?.filter(x => !x.autoHidden && !this.matchesBanned(x)) ?? [];
  }

  hiddenResults(): DiscoveryResult[] {
    return this.results()?.filter(x => x.autoHidden && !this.matchesBanned(x)) ?? [];
  }

  displayedResults(): DiscoveryResult[] {
    switch (this.resultsFilter()) {
      case 'hidden':
        return this.hiddenResults();
      case 'selected':
        return (this.results() ?? []).filter(x => this.selectedIds().includes(x.id) && !this.matchesBanned(x));
      default:
        return this.visibleResults();
    }
  }

  hasQueueItems(): boolean {
    return this.visibleResults().length > 0 || this.hiddenCount() > 0;
  }

  async close() {
    if (this.selectedIds().length > 0) {
      return;
    }
    const hiddenNote = this.hiddenCount() > 0
      ? ` ${this.hiddenCount()} auto-hidden item(s) will also be rejected.`
      : '';
    let dialogRef = this.dialog.open(ConfirmComponent, {
      data: {
        question: `Are you sure you want to close without accepting any episodes? All ${this.visibleResults().length} visible result(s) will be rejected.${hiddenNote}`,
        title: 'Confirm Close'
      },
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result.result === true) {
        await this.save();
      }
    });
  }

  private async confirmSubmit(): Promise<boolean> {
    const unselectedVisible = this.visibleResults().filter(x => !this.selectedIds().includes(x.id)).length;
    const unreviewedHidden = this.includeHidden()
      ? this.results()?.filter(x => x.autoHidden && !this.selectedIds().includes(x.id)).length ?? 0
      : this.hiddenCount();

    if (unselectedVisible === 0 && unreviewedHidden === 0) {
      return true;
    }

    const parts: string[] = [];
    if (unselectedVisible > 0) {
      parts.push(`${unselectedVisible} unselected visible result(s) will be rejected`);
    }
    if (unreviewedHidden > 0) {
      parts.push(`${unreviewedHidden} unreviewed auto-hidden result(s) will be rejected`);
    }

    const dialogRef = this.dialog.open(ConfirmComponent, {
      data: {
        question: `${parts.join(' and ')}. Continue?`,
        title: 'Confirm Submit'
      },
      disableClose: true,
      autoFocus: true
    });
    const result = await firstValueFrom(dialogRef.afterClosed());
    return result?.result === true;
  }

  async save() {
    if (this.selectedIds().length > 0 && !(await this.confirmSubmit())) {
      return;
    }

    this.saveDisabled.set(true);
    this.closeDisabled.set(true);
    this.submittedSubject.next(true);

    const dialog = this.dialog
      .open<DiscoverySubmitComponent, any, SubmitDiscoveryState>(DiscoverySubmitComponent, { disableClose: true, autoFocus: true });
    dialog
      .afterClosed()
      .subscribe(async result => {
        if (result?.heldSubmissionId !== undefined) {
          const submissionId = result.heldSubmissionId;
          const ref = this.snackBar.open("Submitted for review. A supervisor will check it before anything is added.", submissionId ? "View" : "Ok", { duration: 10000 });
          if (submissionId) {
            ref.onAction().subscribe(() => this.router.navigate(["/discovery-submissions", submissionId]));
          }
          this.displaySave.set(false);
          this.submitted.set(true);
          this.submittedSubject.next(true);
          this.selectedIds.set([]);
          this.loadResults(false);
          return;
        }
        if (result?.endpointError && result.errorMessage) {
          this.snackBar.open(result.errorMessage, "Ok", { duration: 15000 });
        }
        if (result && !result.endpointError && !result.allErrored) {
          let snackBarMessage = "Discovery Sent!"
          let snackBarDuration = 10000;
          if (result.hasErrors) {
            snackBarMessage = "Discovery Sent! Errors Occured."
            snackBarDuration = 10000;
            this.resultsFilter.set("errored");
            this.erroredSubject.next(result.erroredItems);
            this.resultsFilterSubject.next(this.resultsFilter());
          }
          const results = result.episodeIds?.length ?? 0;
          const review: boolean = !result.hasErrors && results > 0;
          let snackBarRef = this.snackBar.open(snackBarMessage, review ? "Review" : "Ok", { duration: snackBarDuration });
          if (review) {
            snackBarRef.onAction().subscribe(() => {
              const episodeIds = JSON.stringify(result.episodeIds);
              this.router.navigate(["/episodes", episodeIds])
            });
          }
          this.displaySave.set(false);
          this.submitted.set(true);
          this.submittedSubject.next(this.submitted());
        } else {
          this.submitted.set(false);
          this.submittedSubject.next(this.submitted());
          this.closeDisabled.set(this.selectedIds().length > 0);
          this.saveDisabled.set(this.selectedIds().length === 0);
        }
      });
    await dialog.componentInstance.submit({
      documentIds: this.documentIds(),
      resultIds: this.acceptedResultIds()
    });
  }

  async removePodcast(result: DiscoveryResult): Promise<void> {
    this.isLoading.set(true);
    try {
      const read = await this.banService.ban(result.id, this.includeHidden());
      const refreshed = read.discovery.results.map(item => this.normalizeResult(item));
      const banned: BannedChannel = {
        resultId: result.id,
        podcastId: read.podcast.id,
        showName: result.showName,
        youTubeChannelId: read.podcast.youTubeChannelId ?? result.youTubeChannelId,
        spotifyId: read.podcast.spotifyId ?? result.spotifyId,
        appleId: read.podcast.appleId ?? result.appleId
      };
      this.bannedChannels.update(channels => [...channels, banned]);
      this.results.set(refreshed);
      this.dropBannedSelections();
      this.documentIds.set(read.discovery.ids);
      this.hiddenCount.set(read.discovery.hiddenCount ?? 0);
      this.displaySave.set(this.hasQueueItems());
      this.saveDisabled.set(this.selectedIds().length === 0);
      this.closeDisabled.set(this.selectedIds().length > 0);
      this.snackBar.open(`${read.podcast.name ?? result.showName ?? 'Podcast'} removed`, 'Ok', { duration: 5000 });
    } catch (e) {
      this.snackBar.open(banFailureMessage(e), 'Ok', { duration: 10000 });
    } finally {
      this.isLoading.set(false);
    }
  }

  acceptedResultIds(): string[] {
    return saveResultIds(this.results() ?? [], this.selectedIds(), this.bannedChannels());
  }

  private matchesBanned(result: DiscoveryResult): boolean {
    return matchesBannedChannel(result, this.bannedChannels());
  }

  private dropBannedSelections(): void {
    const results = this.results() ?? [];
    this.selectedIds.update(ids => ids.filter(id => {
      const result = results.find(item => item.id === id);
      return !result || !this.matchesBanned(result);
    }));
  }

  handleEvent($event: { id: string; selected: boolean; }) {
    if ($event.selected) {
      this.selectedIds.update(ids => ids.includes($event.id) ? ids : [...ids, $event.id]);
    } else {
      this.selectedIds.update(ids => ids.filter(x => x !== $event.id));
    }
    this.closeDisabled.set(this.selectedIds().length > 0);
    this.saveDisabled.set(this.selectedIds().length === 0);
  }

  selectLikelyMatches() {
    const likelyIds = this.visibleResults()
      .filter(x => x.acceptProbability != null && x.acceptProbability >= likelyMatchThreshold)
      .map(x => x.id);
    this.selectedIds.update(ids => [...new Set([...ids, ...likelyIds])]);
    this.closeDisabled.set(this.selectedIds().length > 0);
    this.saveDisabled.set(this.selectedIds().length === 0);
    this.submittedSubject.next(false);
  }

  private normalizeResult(result: DiscoveryResult): DiscoveryResult {
    const acceptProbability = result.acceptProbability ?? null;
    const autoHidden = result.autoHidden
      ?? (acceptProbability !== null && acceptProbability < autoHiddenThreshold);
    return { ...result, acceptProbability, autoHidden };
  }

  resultsFilterChange($event: MatButtonToggleChange) {
    const nextFilter = $event.value;
    if (nextFilter === 'hidden' && !this.includeHidden()) {
      this.resultsFilter.set(nextFilter);
      this.loadResults(true);
      return;
    }
    this.resultsFilter.set(nextFilter);
    this.resultsFilterSubject.next(this.resultsFilter());
  }

  /** Admin: free a report held with no live submission behind it. */
  releaseAwaitingReport(report: DiscoveryAwaitingReview) {
    const dialogRef = this.dialog.open(ConfirmComponent, {
      data: {
        question: `Release this held report back to Unprocessed? Use only when no submission is holding it. Nothing will be ingested.`,
        title: 'Release held report'
      },
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result?.result !== true) {
        return;
      }
      this.releasingReportId.set(report.id);
      this.submissions.releaseReport(report.id, 'Released from discovery page by admin').subscribe({
        next: resp => {
          this.releasingReportId.set(null);
          if (resp.status === 'Released') {
            this.snackBar.open('Report released', 'Ok', { duration: 5000 });
            this.loadResults(this.includeHidden());
          } else {
            this.snackBar.open(resp.message ?? `Not released: ${resp.status}`, 'Ok', { duration: 10000 });
          }
        },
        error: e => {
          this.releasingReportId.set(null);
          const body = (e as { error?: { status?: string; submissionIds?: string[] } }).error;
          const live = body?.submissionIds?.length
            ? ` It is still held by ${body.submissionIds.length} live submission(s); release the submission from the review page instead.`
            : '';
          this.snackBar.open(describeSubmissionError(e) + live, 'Ok', { duration: 15000 });
        }
      });
    });
  }

  showHiddenReview() {
    this.resultsFilterChange({ value: 'hidden' } as MatButtonToggleChange);
  }
}
