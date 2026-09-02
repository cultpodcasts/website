import { describe, expect, it } from 'vitest';
import { submitSeriesFromForm } from './submit-series.util';

describe('submitSeriesFromForm', () => {
  it('maps an autocomplete object to podcastId and podcastName', () => {
    expect(submitSeriesFromForm({ id: 'podcast-guid-0001', name: 'Show Name' })).toEqual({
      podcastId: 'podcast-guid-0001',
      podcastName: 'Show Name'
    });
  });

  it('maps a typed string to podcastName without an id', () => {
    expect(submitSeriesFromForm('Typed Show')).toEqual({
      podcastId: undefined,
      podcastName: 'Typed Show'
    });
  });

  it('allows URL-only submit when series is empty or null', () => {
    expect(submitSeriesFromForm(null)).toEqual({
      podcastId: undefined,
      podcastName: undefined
    });
    expect(submitSeriesFromForm(undefined)).toEqual({
      podcastId: undefined,
      podcastName: undefined
    });
    expect(submitSeriesFromForm('')).toEqual({
      podcastId: undefined,
      podcastName: undefined
    });
  });
});
