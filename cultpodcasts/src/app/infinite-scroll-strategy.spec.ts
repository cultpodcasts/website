import { InfiniteScrollStrategy } from './infinite-scroll-strategy';

describe('InfiniteScrollStrategy', () => {
  const strategy = new InfiniteScrollStrategy();

  it('loads enough first-page results to fill complete browse-grid rows', () => {
    expect(strategy.getTake(1)).toBe(20);
  });

  it('loads larger subsequent pages after the first', () => {
    expect(strategy.getTake(2)).toBe(100);
    expect(strategy.getSkip(2)).toBe(20);
    expect(strategy.getSkip(3)).toBe(120);
  });
});
