import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal, ViewChild } from '@angular/core';
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
    DatePipe
  ],
  templateUrl: './discovery-api.component.html',
  styleUrl: './discovery-api.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DiscoveryApiComponent {
  @ViewChild('resultsContainer', { static: false }) resultsContainer: ElementRef | undefined;

  results = signal<DiscoveryResult[] | undefined>(undefined);
  documentIds = signal<string[]>([]);
  selectedIds = signal<string[]>([]);
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

  private destroyRef = inject(DestroyRef);

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router,
    private siteService: SiteService
  ) {
    this.destroyRef.onDestroy(() => this.toggleDiscoverySnapClass(false));
  }

  ngOnInit() {
    this.toggleDiscoverySnapClass(true);

    this.siteService.setQuery(null);
    this.siteService.setPodcast(null);
    this.siteService.setSubject(null);

    this.loadResults(false);
  }

  private toggleDiscoverySnapClass(enabled: boolean) {
    if (typeof document === 'undefined') {
      return;
    }

    const method: 'add' | 'remove' = enabled ? 'add' : 'remove';
    document.documentElement.classList[method]('discovery-snap-enabled');
    document.body.classList[method]('discovery-snap-enabled');
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
            this.documentIds.set(resp.ids);
            this.hiddenCount.set(resp.hiddenCount ?? 0);
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
    return this.results()?.filter(x => !x.autoHidden) ?? [];
  }

  hiddenResults(): DiscoveryResult[] {
    return this.results()?.filter(x => x.autoHidden) ?? [];
  }

  displayedResults(): DiscoveryResult[] {
    switch (this.resultsFilter()) {
      case 'hidden':
        return this.hiddenResults();
      case 'selected':
        return (this.results() ?? []).filter(x => this.selectedIds().includes(x.id));
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
      resultIds: this.selectedIds()
    });
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

  showHiddenReview() {
    this.resultsFilterChange({ value: 'hidden' } as MatButtonToggleChange);
  }
}
