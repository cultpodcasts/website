import { defaultPublisher } from './tv-show-target.util';

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
