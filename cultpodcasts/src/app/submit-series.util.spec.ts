import { describe, expect, it } from 'vitest';
import {
  displaySeriesFormValue,
  seriesNameFromForm,
  showSubmitSeriesPicker,
  submitEpisodePostBody,
  submitSeriesFromForm,
  submitSeriesUiFromLookup
} from './submit-series.util';

describe('showSubmitSeriesPicker', () => {
  it('shows Series picker only for the Curator role, because attaching or naming a series is curator work', () => {
    expect(showSubmitSeriesPicker(['Curator'])).toBe(true);
    expect(showSubmitSeriesPicker(['Admin'])).toBe(false);
    expect(showSubmitSeriesPicker([])).toBe(false);
    expect(showSubmitSeriesPicker(undefined)).toBe(false);
  });
});

describe('displaySeriesFormValue', () => {
  it('shows SimplePodcast.name and Suggestion.label, never Suggestion.name', () => {
    expect(displaySeriesFormValue({ id: 'podcast-guid-0001', name: 'Show Name' })).toBe('Show Name');
    expect(displaySeriesFormValue({
      type: 'podcast',
      value: 'Canonical Show',
      label: 'Display Alias'
    })).toBe('Display Alias');
    expect(displaySeriesFormValue('Typed Show')).toBe('Typed Show');
    expect(displaySeriesFormValue(null)).toBe('');
  });
});

describe('seriesNameFromForm', () => {
  it('reads the canonical name from a typeahead suggestion', () => {
    expect(seriesNameFromForm({
      type: 'podcast',
      value: 'Typed Show',
      label: 'Typed Show'
    })).toBe('Typed Show');
  });
});

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

  it('maps a typeahead suggestion to name only, because search-suggestions have no podcast ids', () => {
    expect(submitSeriesFromForm({
      type: 'podcast',
      value: 'Typed Show',
      label: 'Typed Show'
    })).toEqual({
      podcastId: undefined,
      podcastName: 'Typed Show'
    });
  });
});

describe('submitEpisodePostBody', () => {
  const episodeUrl = new URL('https://www.netflix.com/watch/80057281');

  it('always sends the absolute episode url, including URL-only submit', () => {
    const body = submitEpisodePostBody(episodeUrl, { podcastId: undefined, podcastName: undefined });
    expect(body).toEqual({
      url: episodeUrl.href,
      podcastId: undefined,
      podcastName: undefined
    });
    expect(body).not.toEqual(expect.objectContaining({ podcastName: 'Show Name' }));
    expect(Object.keys(body)).toContain('url');
  });

  it('keeps the same url when resubmitting a 409 name collision with a chosen podcastId', () => {
    expect(submitEpisodePostBody(episodeUrl, {
      podcastId: 'podcast-guid-0001',
      podcastName: 'Duplicate Series Title'
    })).toEqual({
      url: episodeUrl.href,
      podcastId: 'podcast-guid-0001',
      podcastName: 'Duplicate Series Title'
    });
  });
});

describe('submitSeriesUiFromLookup', () => {
  it('hides Series for known unique membership so submit is URL-only', () => {
    expect(submitSeriesUiFromLookup({
      known: true,
      podcastId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      podcastName: 'Stored Show Name'
    }, 'podcast-service')).toBe('readonly');
    expect(submitSeriesUiFromLookup({
      known: true,
      podcastId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      podcastName: 'Stored Show Name'
    }, 'streaming')).toBe('readonly');
  });

  it('hides Series for unknown podcast-service URLs, because platform metadata creates the series', () => {
    expect(submitSeriesUiFromLookup({ known: false, kind: 'podcast-service' }, 'podcast-service')).toBe('hide');
  });

  it('shows Series for unknown streaming URLs, because attach-or-create is the rare path', () => {
    expect(submitSeriesUiFromLookup({ known: false, kind: 'streaming' }, 'streaming')).toBe('picker');
  });

  it('shows Series when membership is ambiguous so the curator can still pick', () => {
    expect(submitSeriesUiFromLookup({
      known: false,
      ambiguous: true,
      podcastIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']
    }, 'streaming')).toBe('picker');
  });

  it('hides Series while lookup is pending or the URL is unrecognised', () => {
    expect(submitSeriesUiFromLookup('pending', 'streaming')).toBe('hide');
    expect(submitSeriesUiFromLookup(null, undefined)).toBe('hide');
    expect(submitSeriesUiFromLookup({ known: false, kind: 'unrecognised' }, undefined)).toBe('hide');
  });

  it('falls back to the client host class when lookup fails', () => {
    expect(submitSeriesUiFromLookup('error', 'streaming')).toBe('picker');
    expect(submitSeriesUiFromLookup('error', 'podcast-service')).toBe('hide');
  });
});
