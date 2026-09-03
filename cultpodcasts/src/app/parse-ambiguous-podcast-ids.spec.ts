import { describe, expect, it } from 'vitest';
import { parseAmbiguousPodcastIds } from './parse-ambiguous-podcast-ids';

const firstId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';

describe('parseAmbiguousPodcastIds', () => {
  it('parses a JSON UUID array from a 409 conflict body', () => {
    expect(parseAmbiguousPodcastIds([firstId, secondId])).toEqual([firstId, secondId]);
  });

  it('rejects a non-array error body', () => {
    expect(parseAmbiguousPodcastIds({ error: 'Unable to retrieve podcast' })).toBeUndefined();
  });

  it('rejects an empty array and non-UUID strings', () => {
    expect(parseAmbiguousPodcastIds([])).toBeUndefined();
    expect(parseAmbiguousPodcastIds(['not-a-uuid'])).toBeUndefined();
    expect(parseAmbiguousPodcastIds([firstId, 'missing'])).toBeUndefined();
  });
});
