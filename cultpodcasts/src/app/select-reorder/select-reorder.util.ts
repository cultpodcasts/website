import { moveItemInArray } from '@angular/cdk/drag-drop';

/**
 * Reorder the selected values of a multi mat-select.
 *
 * `visible` is the selected values in the order the reorderable options are shown. It can be a subset of
 * `values` (for example a stored subject that is no longer in the subject list is still saved but has no
 * option), so the move maps the visible indices onto the value indices and then uses `moveItemInArray`
 * on a copy of the value. Values without an option keep their place relative to each other.
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
  const fromIndex = next.indexOf(visible[from]);
  const toIndex = next.indexOf(visible[to]);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return null;
  }
  moveItemInArray(next, fromIndex, toIndex);
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
