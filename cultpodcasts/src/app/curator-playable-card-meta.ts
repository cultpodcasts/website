/** Compact duration for curator card meta (same formatting as the previous list templates). */
export function curatorCardDuration(duration: string): string {
  const head = duration.split('.')[0];
  return duration.startsWith('0') ? head.substring(1) : head;
}
