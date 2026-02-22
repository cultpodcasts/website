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
