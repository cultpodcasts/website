import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AUTH_SCOPE } from '../auth.interceptor';
import {
  DiscoveryReportReleaseResponse,
  DiscoverySubmissionCommandResponse,
  DiscoverySubmissionDetail,
  DiscoverySubmissionList,
  DiscoverySubmissionReviewRequest,
  DiscoverySubmissionStatus
} from './discovery-supervision.models';
import { DISCOVERY_SUBMISSIONS_SCOPE, DISCOVERY_SUPERVISE_SCOPE } from './discovery-supervision';

/** Optional language / identity answers on a creating apply or retry POST. */
export interface DiscoverySubmissionCreateDecisions {
  languageDecisions?: Record<string, string>;
  identityDecisions?: Record<string, string>;
  selectedIdentityKeys?: Record<string, string>;
}

/** Client for the supervised-discovery routes on the Cloudflare API Worker. */
@Injectable({ providedIn: 'root' })
export class DiscoverySubmissionsService {
  private readonly http = inject(HttpClient);

  /** Last seen supervisor queue length (nav badge). */
  readonly pendingCount = signal<number>(0);

  private url(path: string): string {
    return new URL(path, environment.api).toString();
  }

  private context(scope: string): HttpContext {
    return new HttpContext().set(AUTH_SCOPE, scope);
  }

  list(): Observable<DiscoverySubmissionList> {
    return this.http.get<DiscoverySubmissionList>(this.url('/discovery-submissions'), {
      context: this.context(DISCOVERY_SUBMISSIONS_SCOPE)
    }).pipe(tap(list => {
      if (list.view === 'supervisor') {
        this.pendingCount.set(list.pendingCount);
      }
    }));
  }

  get(id: string): Observable<DiscoverySubmissionDetail> {
    return this.http.get<DiscoverySubmissionDetail>(this.url(`/discovery-submissions/${encodeURIComponent(id)}`), {
      context: this.context(DISCOVERY_SUBMISSIONS_SCOPE)
    });
  }

  saveReview(id: string, body: DiscoverySubmissionReviewRequest): Observable<DiscoverySubmissionCommandResponse> {
    return this.http.put<DiscoverySubmissionCommandResponse>(
      this.url(`/discovery-submissions/${encodeURIComponent(id)}/review`), body,
      { context: this.context(DISCOVERY_SUPERVISE_SCOPE) });
  }

  apply(
    id: string,
    etag: string,
    acceptedResultIds?: string[],
    decisions?: DiscoverySubmissionCreateDecisions
  ): Observable<DiscoverySubmissionCommandResponse> {
    const body: {
      etag: string;
      acceptedResultIds?: string[];
      languageDecisions?: Record<string, string>;
      identityDecisions?: Record<string, string>;
      selectedIdentityKeys?: Record<string, string>;
    } = { etag };
    if (acceptedResultIds) {
      body.acceptedResultIds = acceptedResultIds;
    }
    this.assignDecisions(body, decisions);
    return this.http.post<DiscoverySubmissionCommandResponse>(
      this.url(`/discovery-submissions/${encodeURIComponent(id)}/apply`),
      body,
      { context: this.context(DISCOVERY_SUPERVISE_SCOPE) });
  }

  retry(
    id: string,
    etag: string,
    abandonResultIds: string[] = [],
    decisions?: DiscoverySubmissionCreateDecisions
  ): Observable<DiscoverySubmissionCommandResponse> {
    const body: {
      etag: string;
      abandonResultIds: string[];
      languageDecisions?: Record<string, string>;
      identityDecisions?: Record<string, string>;
      selectedIdentityKeys?: Record<string, string>;
    } = {
      etag,
      abandonResultIds
    };
    this.assignDecisions(body, decisions);
    return this.http.post<DiscoverySubmissionCommandResponse>(
      this.url(`/discovery-submissions/${encodeURIComponent(id)}/retry`),
      body,
      { context: this.context(DISCOVERY_SUPERVISE_SCOPE) });
  }

  release(id: string, etag: string, reason?: string): Observable<DiscoverySubmissionCommandResponse> {
    return this.http.post<DiscoverySubmissionCommandResponse>(
      this.url(`/discovery-submissions/${encodeURIComponent(id)}/release`),
      { etag, reason: reason?.trim() || null },
      { context: this.context(DISCOVERY_SUPERVISE_SCOPE) });
  }

  /** Admin override: set the submission status by hand (reports/outcomes unchanged). */
  changeState(id: string, status: DiscoverySubmissionStatus, etag: string, reason?: string): Observable<DiscoverySubmissionCommandResponse> {
    return this.http.post<DiscoverySubmissionCommandResponse>(
      this.url(`/discovery-submissions/${encodeURIComponent(id)}/state`),
      { status, etag, reason: reason?.trim() || null },
      { context: this.context('admin') });
  }

  /** Admin: free a report stuck as PendingSupervisor with no live submission. */
  releaseReport(documentId: string, reason?: string): Observable<DiscoveryReportReleaseResponse> {
    return this.http.post<DiscoveryReportReleaseResponse>(
      this.url(`/discovery-reports/${encodeURIComponent(documentId)}/release`),
      { reason: reason?.trim() || null },
      { context: this.context('admin') });
  }

  private assignDecisions(
    body: DiscoverySubmissionCreateDecisions,
    decisions?: DiscoverySubmissionCreateDecisions
  ): void {
    if (decisions?.languageDecisions) {
      body.languageDecisions = decisions.languageDecisions;
    }
    if (decisions?.identityDecisions) {
      body.identityDecisions = decisions.identityDecisions;
    }
    if (decisions?.selectedIdentityKeys && Object.keys(decisions.selectedIdentityKeys).length > 0) {
      body.selectedIdentityKeys = decisions.selectedIdentityKeys;
    }
  }
}
