import { moveSelectedValue, reorderAnnouncement, reorderEdgeAnnouncement } from './select-reorder.util';

describe('moveSelectedValue', () => {
  it('moves within the control value when every selected value is shown', () => {
    expect(moveSelectedValue(['a', 'b', 'c'], ['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveSelectedValue(['a', 'b', 'c'], ['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveSelectedValue(['a', 'b', 'c'], ['a', 'b', 'c'], 1, 2)).toEqual(['a', 'c', 'b']);
  });

  it('keeps values without an option in their absolute slots and permutes only the shown slots', () => {
    // 'gone' is stored on the entity but is no longer in the subject list, so it has no option.
    expect(moveSelectedValue(['a', 'gone', 'b', 'c'], ['a', 'b', 'c'], 0, 1)).toEqual(['b', 'gone', 'a', 'c']);
    expect(moveSelectedValue(['a', 'gone', 'b', 'c'], ['a', 'b', 'c'], 2, 0)).toEqual(['c', 'gone', 'a', 'b']);
    expect(moveSelectedValue(['a', 'gone', 'b', 'c'], ['a', 'b', 'c'], 0, 2)).toEqual(['b', 'gone', 'c', 'a']);
  });

  it('never displaces a hidden first or last value', () => {
    expect(moveSelectedValue(['gone', 'a', 'b', 'c'], ['a', 'b', 'c'], 2, 0)).toEqual(['gone', 'c', 'a', 'b']);
    expect(moveSelectedValue(['gone', 'a', 'b', 'c'], ['a', 'b', 'c'], 0, 2)).toEqual(['gone', 'b', 'c', 'a']);
    expect(moveSelectedValue(['a', 'b', 'gone'], ['a', 'b'], 1, 0)).toEqual(['b', 'a', 'gone']);
    expect(moveSelectedValue(['x', 'a', 'y', 'b', 'z'], ['a', 'b'], 0, 1)).toEqual(['x', 'b', 'y', 'a', 'z']);
  });

  it('returns null for a no-op or out-of-range move, and never mutates the input', () => {
    const values = ['a', 'b'];
    expect(moveSelectedValue(values, ['a', 'b'], 1, 1)).toBeNull();
    expect(moveSelectedValue(values, ['a', 'b'], -1, 0)).toBeNull();
    expect(moveSelectedValue(values, ['a', 'b'], 0, 2)).toBeNull();
    expect(moveSelectedValue(null, ['a', 'b'], 0, 1)).toBeNull();
    expect(moveSelectedValue(['a', 'c'], ['a', 'b'], 0, 1)).toBeNull();
    expect(values).toEqual(['a', 'b']);
  });

  it('builds the aria-live text', () => {
    expect(reorderAnnouncement('Scientology', 2, 3)).toBe('Scientology moved to position 2 of 3');
    expect(reorderEdgeAnnouncement('Scientology', 'first')).toBe('Scientology is already first');
  });
});
