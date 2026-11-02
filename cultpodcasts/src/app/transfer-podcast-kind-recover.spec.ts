import { HttpErrorResponse } from '@angular/common/http';
import {
  isConflictStatus,
  isRecoverableTransferTransportError,
  isTransferComplete,
  transferInProgressFromError,
  transferKindPollDelaysMs,
  TRANSFER_KIND_POLL_BUDGET_MS
} from './transfer-podcast-kind-recover';

describe('transfer-podcast-kind-recover', () => {
  it('builds backoff delays that sum to the ~2 minute poll budget', () => {
    const delays = transferKindPollDelaysMs();
    expect(delays.reduce((sum, ms) => sum + ms, 0)).toBe(TRANSFER_KIND_POLL_BUDGET_MS);
    expect(delays[0]).toBe(2_000);
    expect(delays.every(ms => ms <= 30_000)).toBe(true);
  });

  it('treats network, timeout, 499 and 5xx as recoverable transport errors', () => {
    expect(isRecoverableTransferTransportError(new HttpErrorResponse({ status: 0 }))).toBe(true);
    expect(isRecoverableTransferTransportError(new HttpErrorResponse({ status: 408 }))).toBe(true);
    expect(isRecoverableTransferTransportError(new HttpErrorResponse({ status: 499 }))).toBe(true);
    expect(isRecoverableTransferTransportError(new HttpErrorResponse({ status: 500 }))).toBe(true);
    expect(isRecoverableTransferTransportError(new HttpErrorResponse({ status: 504 }))).toBe(true);
    expect(isRecoverableTransferTransportError(new HttpErrorResponse({ status: 400 }))).toBe(false);
    expect(isRecoverableTransferTransportError(new HttpErrorResponse({ status: 404 }))).toBe(false);
    expect(isRecoverableTransferTransportError(new Error('boom'))).toBe(false);
  });

  it('reads transferInProgress only from a 409 body', () => {
    expect(transferInProgressFromError(new HttpErrorResponse({
      status: 409,
      error: { transferInProgress: true }
    }))).toBe(true);
    expect(transferInProgressFromError(new HttpErrorResponse({
      status: 409,
      error: { parentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }
    }))).toBe(false);
    expect(transferInProgressFromError(new HttpErrorResponse({
      status: 500,
      error: { transferInProgress: true }
    }))).toBe(false);
  });

  it('detects 409 conflict status', () => {
    expect(isConflictStatus(new HttpErrorResponse({ status: 409 }))).toBe(true);
    expect(isConflictStatus(new HttpErrorResponse({ status: 500 }))).toBe(false);
  });

  it('is complete only when the target parent exists and the podcast is gone', () => {
    expect(isTransferComplete(true, true)).toBe(true);
    expect(isTransferComplete(true, false)).toBe(false);
    expect(isTransferComplete(false, true)).toBe(false);
    expect(isTransferComplete(false, false)).toBe(false);
  });
});
