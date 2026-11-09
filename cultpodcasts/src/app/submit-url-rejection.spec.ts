import { HttpErrorResponse } from '@angular/common/http';
import {
  GENERIC_SUBMIT_URL_ERROR,
  isSubmitUrlLookupRejected,
  submitUrlErrorDisplay,
  submitUrlHttpRejectionMessage,
  submitUrlLookupRejectionMessage
} from './submit-url-rejection';

const bbcMessage =
  "BBC News pages can't be submitted. Submit the BBC iPlayer episode, or the video from the BBC News YouTube channel.";

describe('isSubmitUrlLookupRejected', () => {
  it('is false for null, error, and older bodies without rejected', () => {
    expect(isSubmitUrlLookupRejected(null)).toBe(false);
    expect(isSubmitUrlLookupRejected('error')).toBe(false);
    expect(isSubmitUrlLookupRejected({ known: false, kind: 'unrecognised' })).toBe(false);
    expect(isSubmitUrlLookupRejected({ known: false, kind: 'unrecognised', rejected: false })).toBe(false);
  });

  it('is true only when rejected is exactly true', () => {
    expect(
      isSubmitUrlLookupRejected({
        known: false,
        kind: 'unrecognised',
        rejected: true,
        message: bbcMessage
      })
    ).toBe(true);
  });
});

describe('submitUrlLookupRejectionMessage', () => {
  it('returns the trimmed server message for a rejected lookup', () => {
    expect(
      submitUrlLookupRejectionMessage({
        known: false,
        kind: 'unrecognised',
        rejected: true,
        message: `  ${bbcMessage}  `
      })
    ).toBe(bbcMessage);
  });

  it('returns undefined when not rejected or message is blank', () => {
    expect(submitUrlLookupRejectionMessage({ known: false, kind: 'unrecognised' })).toBeUndefined();
    expect(
      submitUrlLookupRejectionMessage({
        known: false,
        kind: 'unrecognised',
        rejected: true,
        message: '   '
      })
    ).toBeUndefined();
  });
});

describe('submitUrlHttpRejectionMessage / submitUrlErrorDisplay', () => {
  function err(status: number, body: unknown) {
    return new HttpErrorResponse({ status, error: body, url: 'https://api.example/submit' });
  }

  it('returns the BBC News message for a 400 rejected body', () => {
    const error = err(400, {
      contentKind: 'NewsReport',
      rejected: true,
      message: bbcMessage
    });
    expect(submitUrlHttpRejectionMessage(error)).toBe(bbcMessage);
    expect(submitUrlErrorDisplay(error)).toBe(bbcMessage);
  });

  it('falls back to the generic text when message is absent (e.g. Netflix hubs)', () => {
    const error = err(400, { rejected: true });
    expect(submitUrlHttpRejectionMessage(error)).toBeUndefined();
    expect(submitUrlErrorDisplay(error)).toBe(GENERIC_SUBMIT_URL_ERROR);
  });

  it('falls back when rejected is missing (older Api) or status is not 400', () => {
    expect(submitUrlHttpRejectionMessage(err(400, { message: bbcMessage }))).toBeUndefined();
    expect(submitUrlHttpRejectionMessage(err(500, { rejected: true, message: bbcMessage }))).toBeUndefined();
    expect(submitUrlErrorDisplay(err(500, { rejected: true, message: bbcMessage }))).toBe(
      GENERIC_SUBMIT_URL_ERROR
    );
    expect(submitUrlErrorDisplay(new Error('boom'))).toBe(GENERIC_SUBMIT_URL_ERROR);
  });
});
