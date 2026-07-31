import { FormControl } from '@angular/forms';
import {
  atPrefixedHandleValidator,
  buildPodcastFormControls,
  ensureAtPrefix,
  ensureHashPrefix,
  hashPrefixedTagValidator,
  normalizeHandleControl,
  normalizeHashTagControl,
  normalizePodcastSocialHandles
} from './podcast-form.util';
import { Podcast } from './podcast.interface';

function basePodcast(overrides: Partial<Podcast> = {}): Podcast {
  return {
    removed: false,
    indexAllEpisodes: false,
    bypassShortEpisodeChecking: false,
    alwaysPromoteAsHero: false,
    spotifyId: '',
    appleId: null,
    youTubePublicationDelay: '',
    skipEnrichingFromYouTube: false,
    twitterHandle: '',
    blueskyHandle: '',
    titleRegex: '',
    descriptionRegex: '',
    episodeMatchRegex: '',
    episodeIncludeTitleRegex: '',
    defaultSubject: null,
    ignoreAllEpisodes: false,
    youTubeChannelId: '',
    youTubePlaylistId: '',
    ignoredAssociatedSubjects: [],
    ignoredSubjects: [],
    lang: 'en',
    knownTerms: [],
    minimumDuration: '',
    enrichmentHashTags: null,
    hashTag: null,
    ...overrides
  };
}

describe('ensureAtPrefix', () => {
  it('leaves empty values empty', () => {
    expect(ensureAtPrefix('')).toBe('');
    expect(ensureAtPrefix('   ')).toBe('');
    expect(ensureAtPrefix(null)).toBe('');
    expect(ensureAtPrefix(undefined)).toBe('');
  });

  it('prefixes a bare handle', () => {
    expect(ensureAtPrefix('inthedetailspod')).toBe('@inthedetailspod');
    expect(ensureAtPrefix('  cultpodcasts  ')).toBe('@cultpodcasts');
  });

  it('keeps an existing @ prefix', () => {
    expect(ensureAtPrefix('@cultpodcasts')).toBe('@cultpodcasts');
  });

  it('prefixes each space-delimited handle', () => {
    expect(ensureAtPrefix('@MarkBunker4U XENUTV')).toBe('@MarkBunker4U @XENUTV');
    expect(ensureAtPrefix('MarkBunker4U XENUTV')).toBe('@MarkBunker4U @XENUTV');
    expect(ensureAtPrefix('  @a   @b  ')).toBe('@a @b');
  });

  it('drops lone @ tokens', () => {
    expect(ensureAtPrefix('@')).toBe('');
    expect(ensureAtPrefix('@foo @')).toBe('@foo');
  });
});

describe('atPrefixedHandleValidator', () => {
  const validate = atPrefixedHandleValidator();

  it('allows empty', () => {
    expect(validate(new FormControl(''))).toBeNull();
    expect(validate(new FormControl('  '))).toBeNull();
  });

  it('rejects bare handles and lone @', () => {
    expect(validate(new FormControl('inthedetailspod'))).toEqual({ atPrefixedHandle: true });
    expect(validate(new FormControl('@'))).toEqual({ atPrefixedHandle: true });
  });

  it('accepts @handle', () => {
    expect(validate(new FormControl('@inthedetailspod'))).toBeNull();
    expect(validate(new FormControl('@handle.bsky.social'))).toBeNull();
  });

  it('accepts multiple space-delimited @handles', () => {
    expect(validate(new FormControl('@MarkBunker4U @XENUTV'))).toBeNull();
    expect(validate(new FormControl('@a.bsky.social @b.bsky.social'))).toBeNull();
  });

  it('rejects when any token lacks a leading @', () => {
    expect(validate(new FormControl('@josjojs koskoosoj'))).toEqual({ atPrefixedHandle: true });
    expect(validate(new FormControl('@oiohoho jojjoj'))).toEqual({ atPrefixedHandle: true });
    expect(validate(new FormControl('foo @bar'))).toEqual({ atPrefixedHandle: true });
  });
});

describe('normalizeHandleControl / normalizePodcastSocialHandles', () => {
  it('auto-prefixes twitter and bluesky controls', () => {
    const twitterHandle = new FormControl('foo', { nonNullable: true, validators: [atPrefixedHandleValidator()] });
    const blueskyHandle = new FormControl('bar.bsky.social', { nonNullable: true, validators: [atPrefixedHandleValidator()] });
    expect(twitterHandle.valid).toBe(false);

    normalizeHandleControl(twitterHandle);
    normalizePodcastSocialHandles({ controls: { twitterHandle, blueskyHandle } });

    expect(twitterHandle.value).toBe('@foo');
    expect(blueskyHandle.value).toBe('@bar.bsky.social');
    expect(twitterHandle.valid).toBe(true);
    expect(blueskyHandle.valid).toBe(true);
  });

  it('auto-prefixes each space-delimited token on blur', () => {
    const twitterHandle = new FormControl('@josjojs koskoosoj', {
      nonNullable: true,
      validators: [atPrefixedHandleValidator()]
    });
    expect(twitterHandle.valid).toBe(false);

    normalizeHandleControl(twitterHandle);

    expect(twitterHandle.value).toBe('@josjojs @koskoosoj');
    expect(twitterHandle.valid).toBe(true);
  });
});

describe('buildPodcastFormControls handle prefix', () => {
  it('normalizes loaded handles and validates', () => {
    const form = buildPodcastFormControls(basePodcast({
      twitterHandle: 'inthedetailspod',
      blueskyHandle: '@already.bsky.social'
    }));

    expect(form.twitterHandle.value).toBe('@inthedetailspod');
    expect(form.blueskyHandle.value).toBe('@already.bsky.social');
    expect(form.twitterHandle.valid).toBe(true);
    expect(form.blueskyHandle.valid).toBe(true);
  });

  it('normalizes loaded multi-handles', () => {
    const form = buildPodcastFormControls(basePodcast({
      twitterHandle: '@a b',
      blueskyHandle: 'x.bsky.social y.bsky.social'
    }));

    expect(form.twitterHandle.value).toBe('@a @b');
    expect(form.blueskyHandle.value).toBe('@x.bsky.social @y.bsky.social');
    expect(form.twitterHandle.valid).toBe(true);
    expect(form.blueskyHandle.valid).toBe(true);
  });
});

describe('ensureHashPrefix', () => {
  it('leaves empty values empty', () => {
    expect(ensureHashPrefix('')).toBe('');
    expect(ensureHashPrefix('   ')).toBe('');
    expect(ensureHashPrefix(null)).toBe('');
    expect(ensureHashPrefix(undefined)).toBe('');
  });

  it('prefixes a bare tag', () => {
    expect(ensureHashPrefix('cult')).toBe('#cult');
    expect(ensureHashPrefix('  podcasts  ')).toBe('#podcasts');
  });

  it('keeps an existing # prefix', () => {
    expect(ensureHashPrefix('#cult')).toBe('#cult');
  });

  it('prefixes each space-delimited tag', () => {
    expect(ensureHashPrefix('#cult podcasts')).toBe('#cult #podcasts');
    expect(ensureHashPrefix('cult podcasts')).toBe('#cult #podcasts');
    expect(ensureHashPrefix('  #a   #b  ')).toBe('#a #b');
  });

  it('drops lone # tokens', () => {
    expect(ensureHashPrefix('#')).toBe('');
    expect(ensureHashPrefix('#foo #')).toBe('#foo');
  });
});

describe('hashPrefixedTagValidator', () => {
  const validate = hashPrefixedTagValidator();

  it('allows empty', () => {
    expect(validate(new FormControl(''))).toBeNull();
    expect(validate(new FormControl('  '))).toBeNull();
  });

  it('rejects bare tags and lone #', () => {
    expect(validate(new FormControl('cult'))).toEqual({ hashPrefixedTag: true });
    expect(validate(new FormControl('#'))).toEqual({ hashPrefixedTag: true });
  });

  it('accepts #tag', () => {
    expect(validate(new FormControl('#cult'))).toBeNull();
  });

  it('accepts multiple space-delimited #tags', () => {
    expect(validate(new FormControl('#cult #podcasts'))).toBeNull();
  });

  it('rejects when any token lacks a leading #', () => {
    expect(validate(new FormControl('#cult podcasts'))).toEqual({ hashPrefixedTag: true });
    expect(validate(new FormControl('foo #bar'))).toEqual({ hashPrefixedTag: true });
  });
});

describe('normalizeHashTagControl', () => {
  it('auto-prefixes each space-delimited token on blur', () => {
    const hashTag = new FormControl('#cult podcasts', {
      nonNullable: false,
      validators: [hashPrefixedTagValidator()]
    });
    expect(hashTag.valid).toBe(false);

    normalizeHashTagControl(hashTag);

    expect(hashTag.value).toBe('#cult #podcasts');
    expect(hashTag.valid).toBe(true);
  });
});

describe('buildPodcastFormControls hash tag prefix', () => {
  it('normalizes loaded hash tags and validates', () => {
    const form = buildPodcastFormControls(basePodcast({
      hashTag: 'cult podcasts'
    }));

    expect(form.hashTag.value).toBe('#cult #podcasts');
    expect(form.hashTag.valid).toBe(true);
  });

  it('leaves enrichmentHashTags without hash validators', () => {
    const form = buildPodcastFormControls(basePodcast({
      enrichmentHashTags: ['bare', 'tags']
    }));

    expect(form.enrichmentHashTags.validator).toBeNull();
    expect(form.enrichmentHashTags.valid).toBe(true);
  });
});
