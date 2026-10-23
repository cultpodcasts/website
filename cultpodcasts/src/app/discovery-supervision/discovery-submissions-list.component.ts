import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { DiscoverySubmissionsService } from './discovery-submissions.service';
import { DiscoverySubmissionList, DiscoverySubmissionSummary } from './discovery-supervision.models';
import { describeSubmissionError, inProgressLabel, subjectLabel, submissionStatusLabel } from './discovery-supervision';

/**
 * Supervised-discovery submission list.
 * Route data `mode`: `review` = supervisor queue (/discovery-review), `mine` = submitter's own (/discovery-submissions).
 * The API decides the view from the caller's permissions; the page follows `view`.
 */
@Component({
  selector: 'app-discovery-submissions-list',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule],
  templateUrl: './discovery-submissions-list.component.html',
  styleUrl: './discovery-supervision.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { ngSkipHydration: 'true' }
})
export class DiscoverySubmissionsListComponent implements OnInit {
  private readonly service = inject(DiscoverySubmissionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly list = signal<DiscoverySubmissionList | null>(null);
  protected readonly statusLabel = submissionStatusLabel;
  protected readonly inProgressLabel = inProgressLabel;
  private readonly auth = inject(AuthServiceWrapper, { optional: true });
  protected readonly who = (subject: string | null | undefined) => subjectLabel(subject, this.auth?.userSubject?.() ?? null);

  protected mode(): 'review' | 'mine' {
    return this.route.snapshot.data?.['mode'] === 'review' ? 'review' : 'mine';
  }

  protected title(): string {
    const view = this.list()?.view;
    if (view === 'supervisor' || (!view && this.mode() === 'review')) {
      return 'Discovery review queue';
    }
    return 'My discovery submissions';
  }

  protected detailLink(s: DiscoverySubmissionSummary): string[] {
    return [this.list()?.view === 'supervisor' ? '/discovery-review' : '/discovery-submissions', s.id];
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    }
  }

  load(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.service.list().subscribe({
      next: list => {
        this.list.set(list);
        this.isLoading.set(false);
      },
      error: e => {
        this.error.set(describeSubmissionError(e));
        this.isLoading.set(false);
      }
    });
  }
}
