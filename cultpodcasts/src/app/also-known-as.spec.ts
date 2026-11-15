import { describe, expect, it } from 'vitest';
import { alsoKnownAs } from './also-known-as';

describe('alsoKnownAs', () => {
  it('lists the film alternative titles as "Also known as", and nothing when it has none (RedditPodcastPoster#1431)', () => {
    expect(alsoKnownAs(["Father's House", ' ', 'La casa del padre'])).toEqual({
      visible: "Father's House · La casa del padre",
      hidden: null,
      hiddenCount: 0
    });
    expect(alsoKnownAs(undefined)).toBeNull();
    expect(alsoKnownAs([])).toBeNull();
  });

  it('caps the list at the first 5 titles and reports how many are hidden', () => {
    expect(alsoKnownAs(['One', 'Two', 'Three', 'Four', 'Five'])).toEqual({
      visible: 'One · Two · Three · Four · Five',
      hidden: null,
      hiddenCount: 0
    });
    expect(alsoKnownAs(['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'])).toEqual({
      visible: 'One · Two · Three · Four · Five',
      hidden: 'Six · Seven',
      hiddenCount: 2
    });
  });
});
