import {
  dayRailEntry,
  dayRailLabel,
  defaultRailOrder,
  isDayRailEntry,
  normalizeRailOrder,
  parseDayRailOffset,
  subjectEntries,
  toggleSubjectInRailOrder,
} from './rail-order';

describe('rail-order', () => {
  it('encodes and labels relative day slots as n, n−1, n−2', () => {
    expect(dayRailEntry(0)).toBe('day:0');
    expect(dayRailEntry(2)).toBe('day:2');
    expect(parseDayRailOffset('day:0')).toBe(0);
    expect(parseDayRailOffset('day:3')).toBe(3);
    expect(parseDayRailOffset('day:2026-08-01')).toBeNull();
    expect(parseDayRailOffset('Scientology')).toBeNull();
    expect(isDayRailEntry('day:1')).toBe(true);
    expect(dayRailLabel(0)).toBe('n');
    expect(dayRailLabel(1)).toBe('n−1');
    expect(dayRailLabel(3)).toBe('n−3');
  });

  it('defaults to newest day, then subjects, then older days', () => {
    expect(defaultRailOrder(3, ['A', 'B'])).toEqual([
      'day:0',
      'A',
      'B',
      'day:1',
      'day:2',
    ]);
    expect(defaultRailOrder(0, ['A'])).toEqual(['A']);
    expect(defaultRailOrder(1, [])).toEqual(['day:0']);
  });

  it('upgrades legacy subject-only lists with the default day interleave', () => {
    const { order, changed } = normalizeRailOrder(
      ['NXIVM', 'gone', 'NXIVM', 'Scientology'],
      3,
      ['NXIVM', 'Scientology']
    );
    expect(order).toEqual(['day:0', 'NXIVM', 'Scientology', 'day:1', 'day:2']);
    expect(changed).toBe(true);
  });

  it('preserves mixed order, drops stale subjects, injects missing days', () => {
    const { order, changed } = normalizeRailOrder(
      ['day:1', 'Scientology', 'day:0', 'gone', 'day:9', 'day:1'],
      3,
      ['Scientology', 'NXIVM']
    );
    expect(order).toEqual(['day:1', 'Scientology', 'day:0', 'day:2']);
    expect(changed).toBe(true);
  });

  it('reports unchanged when order already matches the week', () => {
    const saved = ['day:0', 'Scientology', 'day:1'];
    expect(normalizeRailOrder(saved, 2, ['Scientology'])).toEqual({
      order: saved,
      changed: false,
    });
  });

  it('filters subject entries and toggles pins without dropping days', () => {
    expect(subjectEntries(['day:0', 'A', 'day:1', 'B'])).toEqual(['A', 'B']);
    expect(toggleSubjectInRailOrder(['day:0', 'A', 'day:1'], 'A')).toEqual([
      'day:0',
      'day:1',
    ]);
    expect(toggleSubjectInRailOrder(['day:0', 'day:1'], 'B')).toEqual([
      'day:0',
      'day:1',
      'B',
    ]);
  });
});
