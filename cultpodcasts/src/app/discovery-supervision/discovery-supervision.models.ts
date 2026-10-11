import { DiscoveryResult } from '../discovery-result.interface';
import { SubmitDiscoveryItemResult } from '../submit-discovery-item-result.interface';

/** Lifecycle of a supervised discovery submission (Api `discoverySubmissionStatusSchema`). */
export type DiscoverySubmissionStatus = 'Pending' | 'Applying' | 'Applied' | 'PartiallyApplied' | 'ApplyFailed' | 'Released';

/** A report held for supervisor review (GET /discovery-curation `awaitingReview`). */
export interface DiscoveryAwaitingReview {
  id: string;
  discoveryBegan: Date | string;
  resultCount: number;
}

/** 202 from POST /discovery-curation for a `curate:supervised` caller. */
export interface DiscoverySubmissionHeld {
  submissionId: string;
  status: 'Pending';
}

export interface DiscoverySubmissionSummary {
  id: string;
  status: DiscoverySubmissionStatus;
  submitterSubject: string;
  submittedAt: string;
  discoveryResultsDocumentIds: string[];
  submitterAcceptedCount: number;
  supervisorSubject?: string | null;
  appliedAt?: string | null;
  reportComment?: string | null;
  itemCommentCount: number;
  applyError?: string | null;
  failedCount?: number | null;
  succeededCount?: number | null;
  abandonedCount?: number | null;
  releasedAt?: string | null;
  releaseReason?: string | null;
  /** Command currently running (status Applying). */
  inProgressOperation?: DiscoveryInProgressOperation | null;
  inProgressSince?: string | null;
}

export type DiscoveryInProgressOperation = 'Apply' | 'Retry' | 'Release';

export interface DiscoverySubmissionList {
  view: 'supervisor' | 'submitter';
  pendingCount: number;
  submissions: DiscoverySubmissionSummary[];
}

export interface DiscoverySubmissionItemComment {
  resultId: string;
  comment: string;
}

export interface DiscoverySubmissionReport {
  id: string;
  discoveryBegan: string;
  state: 'Unprocessed' | 'PendingSupervisor' | 'Processed';
  results: DiscoveryResult[];
}

export type DiscoveryItemOutcomeState = 'Succeeded' | 'Failed' | 'Abandoned';

export interface DiscoverySubmissionItemOutcome {
  resultId: string;
  state: DiscoveryItemOutcomeState;
  episodeId?: string | null;
  podcastId?: string | null;
  message?: string | null;
  error?: string | null;
  attempts: number;
  lastAttemptAt?: string | null;
}

export interface DiscoverySubmissionHistory {
  at: string;
  actorSubject?: string | null;
  action: string;
}

export interface DiscoverySubmissionDetail {
  id: string;
  status: DiscoverySubmissionStatus;
  etag: string;
  canReview: boolean;
  submitterSubject: string;
  submittedAt: string;
  submitterAcceptedResultIds: string[];
  supervisorAcceptedResultIds?: string[] | null;
  addedBySupervisorResultIds?: string[] | null;
  removedBySupervisorResultIds?: string[] | null;
  reportComment?: string | null;
  itemComments: DiscoverySubmissionItemComment[];
  supervisorSubject?: string | null;
  appliedAt?: string | null;
  applyError?: string | null;
  erroredResultIds?: string[] | null;
  itemOutcomes?: DiscoverySubmissionItemOutcome[] | null;
  releasedAt?: string | null;
  releaseReason?: string | null;
  inProgressOperation?: DiscoveryInProgressOperation | null;
  inProgressSince?: string | null;
  reports: DiscoverySubmissionReport[];
  history: DiscoverySubmissionHistory[];
}

export interface DiscoverySubmissionReviewRequest {
  etag: string;
  reportComment?: string | null;
  itemComments?: DiscoverySubmissionItemComment[] | null;
  acceptedResultIds?: string[] | null;
}

export interface DiscoverySubmissionCommandResponse {
  submissionId: string;
  status: DiscoverySubmissionStatus;
  etag?: string | null;
  addedBySupervisorResultIds?: string[] | null;
  removedBySupervisorResultIds?: string[] | null;
  message?: string | null;
  ids?: string[] | null;
  outcome?: { message: string; errorsOccurred: boolean; results: SubmitDiscoveryItemResult[] } | null;
  itemOutcomes?: DiscoverySubmissionItemOutcome[] | null;
}

export interface DiscoveryReportReleaseResponse {
  documentId: string;
  status: 'Released' | 'Conflict' | 'NotFound' | 'Forbidden';
  message?: string | null;
  submissionIds?: string[] | null;
}
