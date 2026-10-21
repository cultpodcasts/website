export function filterKeepingSelectedInOrder(
  subjects: string[],
  filterTerm: string,
  selectedSubjects: ReadonlySet<string>
): string[] {
  const trimmedTerm = filterTerm.trim().toLowerCase();
  if (!trimmedTerm) {
    return subjects;
  }

  return subjects.filter(subject =>
    selectedSubjects.has(subject) || subject.toLowerCase().includes(trimmedTerm)
  );
}

/** True on desktop (fine pointer + hover), where the subject selects take typed filter text. */
export function isDesktopSubjectTypingEnabled(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/**
 * Typing filter for the subject mat-selects (podcast and catalogue parent edit dialogs):
 * printable keys append, Backspace removes one character, Escape clears.
 */
export function applySubjectFilterKey(
  event: KeyboardEvent,
  filterTerm: { (): string; set(value: string): void },
  enabled: boolean
): void {
  if (!enabled || event.ctrlKey || event.altKey || event.metaKey) {
    return;
  }
  if (event.key === 'Backspace') {
    const value = filterTerm();
    if (value.length > 0) {
      filterTerm.set(value.substring(0, value.length - 1));
    }
    event.preventDefault();
    return;
  }
  if (event.key === 'Escape') {
    filterTerm.set('');
    event.preventDefault();
    return;
  }
  if (event.key.length === 1) {
    filterTerm.set(filterTerm() + event.key);
    event.preventDefault();
  }
}
