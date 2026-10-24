import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { BehaviorSubject, Observable, firstValueFrom, of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DiscoveryItemComponent } from '../discovery-item/discovery-item.component';
import { DiscoveryResult } from '../discovery-result.interface';
import {
  DiscoverySubmissionCreateDecisions,
  DiscoverySubmissionsService
} from './discovery-submissions.service';
import { DiscoverySubmissionDetail, DiscoverySubmissionItemOutcome, DiscoverySubmissionStatus } from './discovery-supervision.models';
import { MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatExpansionModule } from '@angular/material/expansion';
import { EpisodesApiComponent } from '../episodes-api/episodes-api.component';
import { ConfirmComponent } from '../confirm/confirm.component';
import {
  promptAmbiguousIdentities,
  promptUnsupportedLanguages
} from '../submit-language-identity-prompts';
import {
  PickState,
  ADMIN_ROLE,
  CURATOR_ROLE,
  canEditReview,
  ADMIN_SETTABLE_STATUSES,
  historyText,
  inProgressLabel,
  canRelease,
  canRetry,
  commentsToMap,
  describeSubmissionError,
  failedOutcomes,
  succeededEpisodeIds,
  subjectLabel,
  itemChip,
  episodesReviewRoute,
  initialFinalIds,
  mapToComments,
  outcomeFor,
  pickDiff,
  pickState,
  pickStateLabels,
  submissionStatusLabel
} from './discovery-supervision';

export interface ReviewRow {
  reportId: string;
  result: DiscoveryResult;
  pick: PickState;
  outcome: DiscoverySubmissionItemOutcome | undefined;
  chip: ReturnType<typeof itemChip>;
}

/**
 * One supervised discovery submission. Supervisors (canReview) rework the accepted
 * set, comment per item / per report, save, apply, retry failures or release.
 * Submitters see the same page read-only with the supervisor's comments and outcomes.
 */
@Component({
  selector: 'app-discovery-submission-detail',
  imports: [
    EpisodesApiComponent,
    MatExpansionModule,
    DatePipe, RouterLink, MatButtonModule, MatButtonToggleModule, MatCheckboxModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatProgressBarModule, DiscoveryItemComponent
  ],
  templateUrl: './discovery-submission-detail.component.html',
  styleUrl: './discovery-supervision.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { ngSkipHydration: 'true' }
})
export class DiscoverySubmissionDetailComponent implements OnInit {
  private readonly service = inject(DiscoverySubmissionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly isLoading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly detail = signal<DiscoverySubmissionDetail | null>(null);
  /** Supervisor's working accepted set. */
  protected readonly finalIds = signal<string[]>([]);
  protected readonly reportComment = signal('');
  protected readonly itemComments = signal<Record<string, string>>({});
  protected readonly dirty = signal(false);
  protected readonly filter = signal<'all' | 'picked'>('all');
  protected readonly releaseReason = signal('');
  protected readonly abandonIds = signal<string[]>([]);

  protected readonly statusLabel = submissionStatusLabel;
  protected readonly pickLabels = pickStateLabels;
  /** Locks discovery-item selection when the page is read-only. */
  protected readonly lockedEvent: Observable<boolean> = of(true);
  protected readonly unlockedEvent = new BehaviorSubject<boolean>(false);

  private readonly auth = inject(AuthServiceWrapper);
  private readonly roles = toSignal(this.auth.roles, { initialValue: [] as string[] });
  /** 'you' / 'Google user …1962' style label; full subject goes in a title tooltip. */
  protected readonly who = (subject: string | null | undefined) => subjectLabel(subject, this.auth.userSubject?.() ?? null);
  /** Episode name for a result id (retry list), falling back to the id. */
  protected readonly resultName = (resultId: string) =>
    this.detail()?.reports.flatMap(r => r.results).find(r => r.id === resultId)?.episodeName ?? resultId;
  protected readonly inProgressLabel = inProgressLabel;
  protected readonly applying = computed(() => this.detail()?.status === 'Applying');
  protected readonly isAdmin = computed(() => this.roles().includes(ADMIN_ROLE));
  /** /episodes/:ids is Curator-only, so Review links/actions are offered only to Curators. */
  protected readonly isCurator = computed(() => this.roles().includes(CURATOR_ROLE));
  protected readonly settableStatuses = ADMIN_SETTABLE_STATUSES;
  protected readonly historyText = historyText;
  protected readonly newStatus = signal<DiscoverySubmissionStatus | ''>('');
  protected readonly stateReason = signal('');
  protected readonly editable = computed(() => {
    const d = this.detail();
    return !!d && canEditReview(d);
  });
  protected readonly retryable = computed(() => {
    const d = this.detail();
    return !!d && canRetry(d);
  });
  protected readonly releasable = computed(() => {
    const d = this.detail();
    return !!d && canRelease(d);
  });
  protected readonly diff = computed(() => {
    const d = this.detail();
    return d ? pickDiff(d.submitterAcceptedResultIds, this.finalIds()) : { added: [], removed: [] };
  });
  /** Episodes ingested by this submission; drives the persistent Review link. */
  protected readonly ingestedEpisodeIds = computed(() => {
    const d = this.detail();
    return d && (d.status === 'Applied' || d.status === 'PartiallyApplied') ? succeededEpisodeIds(d.itemOutcomes) : [];
  });
  protected readonly ingestedEpisodesRoute = computed(() => episodesReviewRoute(this.ingestedEpisodeIds()));
  protected readonly failed = computed(() => failedOutcomes(this.detail()?.itemOutcomes));

  protected readonly rows = computed<ReviewRow[]>(() => {
    const d = this.detail();
    if (!d) {
      return [];
    }
    const finalIds = this.finalIds();
    const comments = this.itemComments();
    const rows: ReviewRow[] = [];
    for (const report of d.reports) {
      for (const result of report.results) {
        const pick = pickState(result.id, d.submitterAcceptedResultIds, finalIds);
        const outcome = outcomeFor(d.itemOutcomes, result.id);
        if (this.filter() === 'picked' && pick === 'none' && !comments[result.id] && !outcome) {
          continue;
        }
        rows.push({ reportId: report.id, result: this.normalize(result), pick, outcome, chip: itemChip(pick, outcome) });
      }
    }
    return rows;
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      void this.load();
    }
  }

  private id(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  async load(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const d = await firstValueFrom(this.service.get(this.id()));
      this.detail.set(d);
      this.finalIds.set(initialFinalIds(d));
      this.reportComment.set(d.reportComment ?? '');
      this.itemComments.set(commentsToMap(d.itemComments));
      this.abandonIds.set([]);
      this.dirty.set(false);
      if (!canEditReview(d)) {
        this.filter.set('picked');
      }
    } catch (e) {
      this.error.set(describeSubmissionError(e));
    } finally {
      this.isLoading.set(false);
    }
  }

  toggle(event: { id: string; selected: boolean }): void {
    if (!this.editable()) {
      return;
    }
    this.finalIds.update(ids => event.selected
      ? (ids.includes(event.id) ? ids : [...ids, event.id])
      : ids.filter(x => x !== event.id));
    this.dirty.set(true);
  }

  setItemComment(resultId: string, value: string): void {
    this.itemComments.update(m => ({ ...m, [resultId]: value }));
    this.dirty.set(true);
  }

  setReportComment(value: string): void {
    this.reportComment.set(value);
    this.dirty.set(true);
  }

  resetToSubmitter(): void {
    const d = this.detail();
    if (d) {
      this.finalIds.set([...d.submitterAcceptedResultIds]);
      this.dirty.set(true);
    }
  }

  toggleAbandon(resultId: string, checked: boolean): void {
    this.abandonIds.update(ids => checked ? [...new Set([...ids, resultId])] : ids.filter(x => x !== resultId));
  }

  /** PUT review; returns the new etag. */
  private async saveReviewInternal(d: DiscoverySubmissionDetail): Promise<string> {
    const resp = await firstValueFrom(this.service.saveReview(d.id, {
      etag: d.etag,
      reportComment: this.reportComment().trim(),
      itemComments: mapToComments(this.itemComments()),
      acceptedResultIds: this.finalIds()
    }));
    this.dirty.set(false);
    return resp.etag ?? d.etag;
  }

  async saveDraft(): Promise<void> {
    const d = this.detail();
    if (!d || !this.editable()) return;
    await this.run(async () => {
      await this.saveReviewInternal(d);
      this.snackBar.open('Review saved', 'Ok', { duration: 4000 });
    });
  }

  async apply(): Promise<void> {
    const d = this.detail();
    if (!d || !this.editable()) return;
    await this.run(async () => {
      const etag = this.dirty() ? await this.saveReviewInternal(d) : d.etag;
      let acceptedIds = this.finalIds();
      let languageDecisions: Record<string, string> | undefined;
      let identityDecisions: Record<string, string> | undefined;
      let selectedIdentityKeys: Record<string, string> | undefined;
      let resp = await firstValueFrom(this.service.apply(d.id, etag, acceptedIds));

      const languageRequired = resp.outcome?.languageDecisionsRequired ?? [];
      if (languageRequired.length > 0) {
        const language = await promptUnsupportedLanguages(this.dialog, languageRequired, acceptedIds);
        acceptedIds = language.idsToCreate;
        if (acceptedIds.length === 0) {
          this.snackBar.open('Nothing was created', 'Ok', { duration: 4000 });
          return;
        }
        languageDecisions = language.languageDecisions;
        resp = await firstValueFrom(this.service.apply(
          d.id, resp.etag ?? etag, acceptedIds, { languageDecisions }));
      }

      const identityRequired = resp.outcome?.identityDecisionsRequired ?? [];
      if (identityRequired.length > 0) {
        const identity = await promptAmbiguousIdentities(this.dialog, identityRequired, acceptedIds);
        acceptedIds = identity.idsToCreate;
        if (acceptedIds.length === 0) {
          this.snackBar.open('Nothing was created', 'Ok', { duration: 4000 });
          return;
        }
        identityDecisions = identity.identityDecisions;
        selectedIdentityKeys = identity.selectedIdentityKeys;
        const decisions: DiscoverySubmissionCreateDecisions = {
          ...(languageDecisions ? { languageDecisions } : {}),
          identityDecisions,
          ...(Object.keys(selectedIdentityKeys).length > 0 ? { selectedIdentityKeys } : {})
        };
        resp = await firstValueFrom(this.service.apply(d.id, resp.etag ?? etag, acceptedIds, decisions));
      }

      const failedCount = (resp.itemOutcomes ?? []).filter(o => o.state === 'Failed').length;
      this.notifyWithReview(
        resp.status === 'Applied' ? 'Applied' : `${submissionStatusLabel(resp.status)}${failedCount ? `: ${failedCount} item(s) failed` : ''}`,
        resp.itemOutcomes);
    });
  }

  async retry(): Promise<void> {
    const d = this.detail();
    if (!d || !this.retryable()) return;
    await this.run(async () => {
      let abandonIds = this.abandonIds();
      let languageDecisions: Record<string, string> | undefined;
      let identityDecisions: Record<string, string> | undefined;
      let selectedIdentityKeys: Record<string, string> | undefined;
      let resp = await firstValueFrom(this.service.retry(d.id, d.etag, abandonIds));

      const languageRequired = resp.outcome?.languageDecisionsRequired ?? [];
      if (languageRequired.length > 0) {
        // Retry abandons cancelled prompted ids; create-set is the non-cancelled prompted ids only.
        const language = await promptUnsupportedLanguages(this.dialog, languageRequired, []);
        if (language.idsToCreate.length === 0) {
          this.snackBar.open('Nothing was created', 'Ok', { duration: 4000 });
          return;
        }
        abandonIds = [...new Set([...abandonIds, ...language.cancelledIds])];
        languageDecisions = language.languageDecisions;
        resp = await firstValueFrom(this.service.retry(
          d.id, resp.etag ?? d.etag, abandonIds, { languageDecisions }));
      }

      const identityRequired = resp.outcome?.identityDecisionsRequired ?? [];
      if (identityRequired.length > 0) {
        const identity = await promptAmbiguousIdentities(this.dialog, identityRequired, []);
        if (identity.idsToCreate.length === 0) {
          this.snackBar.open('Nothing was created', 'Ok', { duration: 4000 });
          return;
        }
        abandonIds = [...new Set([...abandonIds, ...identity.cancelledIds])];
        identityDecisions = identity.identityDecisions;
        selectedIdentityKeys = identity.selectedIdentityKeys;
        const decisions: DiscoverySubmissionCreateDecisions = {
          ...(languageDecisions ? { languageDecisions } : {}),
          identityDecisions,
          ...(Object.keys(selectedIdentityKeys).length > 0 ? { selectedIdentityKeys } : {})
        };
        resp = await firstValueFrom(this.service.retry(d.id, resp.etag ?? d.etag, abandonIds, decisions));
      }

      this.notifyWithReview(`Retry: ${submissionStatusLabel(resp.status)}`, resp.itemOutcomes);
    });
  }

  /** Admin override with confirmation; reloads after. */
  async changeState(): Promise<void> {
    const d = this.detail();
    const status = this.newStatus();
    if (!d || !this.isAdmin() || !status) return;
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmComponent, {
      data: {
        title: 'Change submission state',
        question: `Change this submission from ${d.status} to ${status}? Reports and item outcomes are not changed.`
      },
      disableClose: true,
      autoFocus: true
    }).afterClosed());
    if (confirmed?.result !== true) return;
    await this.run(async () => {
      const resp = await firstValueFrom(this.service.changeState(d.id, status, d.etag, this.stateReason()));
      this.newStatus.set('');
      this.stateReason.set('');
      this.snackBar.open(`State changed to ${submissionStatusLabel(resp.status)}`, 'Ok', { duration: 8000 });
    });
  }

  async release(): Promise<void> {
    const d = this.detail();
    if (!d || !this.releasable()) return;
    await this.run(async () => {
      await firstValueFrom(this.service.release(d.id, d.etag, this.releaseReason()));
      this.releaseReason.set('');
      this.snackBar.open('Released. Reports are back in discovery.', 'Ok', { duration: 8000 });
    });
  }

  /** Snackbar with a Review action to the episode edit page when episodes were ingested (mirrors normal discovery submit). */
  private notifyWithReview(message: string, outcomes: DiscoverySubmissionDetail['itemOutcomes']): void {
    const ids = this.isCurator() ? succeededEpisodeIds(outcomes) : [];
    const ref = this.snackBar.open(message, ids.length ? 'Review' : 'Ok', { duration: 10000 });
    if (ids.length) {
      ref.onAction().subscribe(() => this.router.navigate(episodesReviewRoute(ids)));
    }
  }

  /** Run a command, then reload for fresh state/etag; failures are shown and also reload. */
  private async run(command: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    let message: string | null = null;
    try {
      await command();
    } catch (e) {
      message = describeSubmissionError(e);
    }
    const keepEdits = message !== null ? this.snapshotEdits() : null;
    await this.load();
    if (keepEdits) {
      // Keep the supervisor's unsaved work if a command failed.
      this.finalIds.set(keepEdits.finalIds);
      this.reportComment.set(keepEdits.reportComment);
      this.itemComments.set(keepEdits.itemComments);
      this.dirty.set(keepEdits.dirty);
    }
    if (message) {
      this.error.set(message);
    }
    this.busy.set(false);
  }

  private snapshotEdits() {
    return {
      finalIds: this.finalIds(),
      reportComment: this.reportComment(),
      itemComments: this.itemComments(),
      dirty: this.dirty()
    };
  }

  protected backLink(): string {
    return this.router.url.startsWith('/discovery-review') ? '/discovery-review' : '/discovery-submissions';
  }

  private normalize(result: DiscoveryResult): DiscoveryResult {
    const released = typeof result.released === 'string' ? new Date(result.released) : result.released;
    return { ...result, released, acceptProbability: result.acceptProbability ?? null, autoHidden: result.autoHidden ?? false };
  }
}
