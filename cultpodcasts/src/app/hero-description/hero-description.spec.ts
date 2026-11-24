import { describe, expect, it } from 'vitest';
import {
  clampOverflows,
  heroDescToggleIcon,
  heroDescToggleLabel,
  HeroDescToggleIcon,
  HeroDescToggleLabel,
} from './hero-description';

describe('hero description expander helpers', () => {
  it('keeps the homepage wording and icons (shared with the item page hero)', () => {
    expect(HeroDescToggleLabel.Expand).toBe('Expand description');
    expect(HeroDescToggleLabel.Collapse).toBe('Collapse description');
    expect(HeroDescToggleIcon.Expand).toBe('expand_more');
    expect(HeroDescToggleIcon.Collapse).toBe('expand_less');
  });

  it('labels and icons follow the expanded state', () => {
    expect(heroDescToggleLabel(false)).toBe(HeroDescToggleLabel.Expand);
    expect(heroDescToggleLabel(true)).toBe(HeroDescToggleLabel.Collapse);
    expect(heroDescToggleIcon(false)).toBe(HeroDescToggleIcon.Expand);
    expect(heroDescToggleIcon(true)).toBe(HeroDescToggleIcon.Collapse);
  });

  it('overflows only past a 1px rounding slop', () => {
    expect(clampOverflows({ scrollHeight: 100, clientHeight: 100 })).toBe(false);
    expect(clampOverflows({ scrollHeight: 101, clientHeight: 100 })).toBe(false);
    expect(clampOverflows({ scrollHeight: 102, clientHeight: 100 })).toBe(true);
    expect(clampOverflows({ scrollHeight: 240, clientHeight: 100 })).toBe(true);
  });
});