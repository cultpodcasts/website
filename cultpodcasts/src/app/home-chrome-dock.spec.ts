import { describe, expect, it } from 'vitest';
import {
  HOME_DOCK_ENTER_SLACK_PX,
  HOME_DOCK_EXIT_SLACK_PX,
  homePinScrollY,
  homeStickTopPx,
  nextHomeDocked,
} from './home-chrome-dock';

// Wide chrome CSS: --site-chrome-bar-h 58px, --site-chrome-search-gap 12px, --nflx-search-h 48px.
const wide = { slotTop: 0, barHeight: 58, gap: 12, searchHeight: 48 };

describe('home chrome dock (CHROME-DOCK-012)', () => {
  it('pins where the sticky field catches: bar + gap - sticky top', () => {
    expect(homeStickTopPx(wide)).toBe(5);
    expect(homePinScrollY(wide)).toBe(65);
    expect(homePinScrollY({ ...wide, slotTop: 10 })).toBe(75);
  });

  it('keeps the exit line below the entry line (hysteresis band)', () => {
    expect(HOME_DOCK_EXIT_SLACK_PX).toBeGreaterThan(HOME_DOCK_ENTER_SLACK_PX);
  });

  it('docks at the pin (with sub-pixel slack) and undocks only clearly below it', () => {
    const pin = homePinScrollY(wide);
    expect(nextHomeDocked(false, pin - 1.5, pin)).toBe(false);
    expect(nextHomeDocked(false, pin - 0.5, pin)).toBe(true);
    expect(nextHomeDocked(true, pin - 2.5, pin)).toBe(true);
    expect(nextHomeDocked(true, pin - 3.5, pin)).toBe(false);
  });

  it('never flips on repeated syncs at the same scroll position, including fractional scrollY', () => {
    const pin = homePinScrollY(wide);
    for (let y = pin - 10; y <= pin + 10; y += 0.0625) {
      for (const start of [false, true]) {
        let docked = start;
        const seen: boolean[] = [];
        for (let frame = 0; frame < 6; frame++) {
          docked = nextHomeDocked(docked, y, pin);
          seen.push(docked);
        }
        // After the first sync the state must hold frame after frame.
        expect(new Set(seen.slice(1)).size, `y=${y} start=${start}`).toBe(1);
        expect(seen[1]).toBe(seen[0]);
      }
    }
  });

  it('does not depend on the rendered toolbar height (the old 61px-vs-58px oscillation)', () => {
    // Old code measured a 61px toolbar for undock but the field sat at the 58px CSS
    // bar: dock at y >= 62.5, undock at y < 64.5 — every frame in 62.5..64.5 flipped.
    // The pin now comes only from the CSS values, so dock and undock share it.
    const pin = homePinScrollY(wide);
    let docked = false;
    const states: boolean[] = [];
    for (const y of [61.533, 62.5, 63, 63.75, 64, 64.5, 63, 61.533]) {
      docked = nextHomeDocked(docked, y, pin);
      states.push(docked);
      expect(nextHomeDocked(docked, y, pin)).toBe(docked);
    }
    expect(states).toEqual([false, false, false, false, true, true, true, false]);
  });
});
