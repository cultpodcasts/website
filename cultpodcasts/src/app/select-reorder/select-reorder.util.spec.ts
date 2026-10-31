import { moveSelectedValue, reorderAnnouncement, reorderEdgeAnnouncement } from './select-reorder.util';

describe('moveSelectedValue', () => {
  it('moves within the control value when every selected value is shown', () => {
    expect(moveSelectedValue(['a', 'b', 'c'], ['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveSelectedValue(['a', 'b', 'c'], ['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveSelectedValue(['a', 'b', 'c'], ['a', 'b', 'c'], 1, 2)).toEqual(['a', 'c', 'b']);
  });

  it('maps shown indices onto the value when a selected value has no option (kept, not dropped)', () => {
    // 'gone' is stored on the entity but is no longer in the subject list, so it has no option.
    expect(moveSelectedValue(['a', 'gone', 'b', 'c'], ['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'gone', 'b']);
    expect(moveSelectedValue(['a', 'gone', 'b', 'c'], ['a', 'b', 'c'], 0, 1)).toEqual(['gone', 'b', 'a', 'c']);
  });

  it('returns null for a no-op or out-of-range move, and never mutates the input', () => {
    const values = ['a', 'b'];
    expect(moveSelectedValue(values, ['a', 'b'], 1, 1)).toBeNull();
    expect(moveSelectedValue(values, ['a', 'b'], -1, 0)).toBeNull();
    expect(moveSelectedValue(values, ['a', 'b'], 0, 2)).toBeNull();
    expect(moveSelectedValue(null, ['a', 'b'], 0, 1)).toBeNull();
    expect(values).toEqual(['a', 'b']);
  });

  it('builds the aria-live text', () => {
    expect(reorderAnnouncement('Scientology', 2, 3)).toBe('Scientology moved to position 2 of 3');
    expect(reorderEdgeAnnouncement('Scientology', 'first')).toBe('Scientology is already first');
  });
});
