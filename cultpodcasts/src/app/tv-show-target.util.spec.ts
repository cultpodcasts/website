import { defaultPublisher, isGuid } from './tv-show-target.util';

describe('defaultPublisher', () => {
  it('is blank for other podcasts', () => {
    expect(defaultPublisher('Synthetic Podcast')).toBe('');
    expect(defaultPublisher(null)).toBe('');
    expect(defaultPublisher(undefined)).toBe('');
  });

  it('is BBC for the BBC catch-all podcasts, ignoring case and padding', () => {
    expect(defaultPublisher('BBC')).toBe('BBC');
    expect(defaultPublisher('  bbc three ')).toBe('BBC');
  });
});

describe('isGuid', () => {
  it('accepts a GUID in either case and rejects a show name or a GUID with extra text', () => {
    expect(isGuid('9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d')).toBe(true);
    expect(isGuid('9A8B7C6D-5E4F-4A3B-9C2D-1E0F2A3B4C5D')).toBe(true);
    expect(isGuid('Synthetic Show')).toBe(false);
    expect(isGuid('9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d extra')).toBe(false);
  });
});
