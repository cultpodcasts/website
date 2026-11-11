import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  ADDITIONAL_YOU_TUBE_CHANNEL_IS_MAIN_CHANNEL,
  catalogueParentSaveError,
  CHANNEL_WIDE_YOU_TUBE_CONFLICT,
  INVALID_ADDITIONAL_YOU_TUBE_CHANNEL_ID
} from './catalogue-parent-save-error';

function httpError(status: number, error: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error });
}

describe('catalogueParentSaveError (RPP #1370)', () => {
  it('shows the API message for the additional-channel and channel-wide 400 codes', () => {
    for (const code of [INVALID_ADDITIONAL_YOU_TUBE_CHANNEL_ID, ADDITIONAL_YOU_TUBE_CHANNEL_IS_MAIN_CHANNEL, CHANNEL_WIDE_YOU_TUBE_CONFLICT]) {
      expect(catalogueParentSaveError(httpError(400, { message: 'Synthetic refusal.', code }))).toBe('Synthetic refusal. Nothing was changed.');
    }
  });

  it('names the owner on a 409 service-id conflict', () => {
    expect(
      catalogueParentSaveError(
        httpError(409, { message: 'additionalYouTubeChannelIds UCsyntheticChannel000002 is already used', ids: ['dddddddd-dddd-4ddd-8ddd-dddddddddddd'] })
      )
    ).toBe('Already used by another news outlet, TV show or podcast: additionalYouTubeChannelIds UCsyntheticChannel000002 is already used. Nothing was changed.');
  });

  it('leaves other failures to the generic copy', () => {
    expect(catalogueParentSaveError(httpError(400, { message: 'Other', code: 'somethingElse' }))).toBeUndefined();
    expect(catalogueParentSaveError(httpError(400, { message: 'No code' }))).toBeUndefined();
    expect(catalogueParentSaveError(httpError(409, { ids: [] }))).toBeUndefined();
    expect(catalogueParentSaveError(httpError(500, { message: 'Boom' }))).toBeUndefined();
    expect(catalogueParentSaveError(httpError(409, 'text body'))).toBeUndefined();
    expect(catalogueParentSaveError(new Error('x'))).toBeUndefined();
  });
});
