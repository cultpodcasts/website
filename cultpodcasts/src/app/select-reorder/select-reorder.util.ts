import { moveItemInArray } from '@angular/cdk/drag-drop';

/**
 * Reorder the selected values of a multi mat-select.
 *
 * `visible` is the selected values in the order the reorderable options are shown. It can be a subset of
 * `values` (for example a stored subject that is no longer in the subject list is still saved but has no
 * option). Values without an option keep their absolute slots in the value; only the slots of the shown
 * values are permuted, with `moveItemInArray` applied to the shown order. So a move can never promote a
 * hidden value to first place: `['a', 'gone', 'b', 'c']` with `a` moved down one gives
 * `['b', 'gone', 'a', 'c']`.
 *
 * Returns null when nothing would change.
 */
export function moveSelectedValue(
  values: readonly string[] | null | undefined,
  visible: readonly string[],
  from: number,
  to: number
): string[] | null {
  if (from === to || from < 0 || to < 0 || from >= visible.length || to >= visible.length) {
    return null;
  }
  const next = [...(values ?? [])];
  const slots = visible.map(value => next.indexOf(value));
  if (slots.some(slot => slot < 0) || new Set(slots).size !== slots.length) {
    return null;
  }
  const order = [...visible];
  moveItemInArray(order, from, to);
  // Shown values are in value order (regroup keeps it), but sort the slots so the mapping holds anyway.
  const sortedSlots = [...slots].sort((x, y) => x - y);
  sortedSlots.forEach((slot, i) => {
    next[slot] = order[i];
  });
  return next;
}

/** The aria-live text after a selected option moves. */
export function reorderAnnouncement(label: string, position: number, total: number): string {
  return `${label} moved to position ${position} of ${total}`;
}

/** The aria-live text when a keyboard move is already at the top or bottom. */
export function reorderEdgeAnnouncement(label: string, edge: 'first' | 'last'): string {
  return `${label} is already ${edge}`;
}
