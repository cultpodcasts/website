export type SubmitUrlLookupKind = 'podcast-service' | 'streaming' | 'unrecognised';

export type SubmitUrlLookupResponse =
  | { known: true; podcastId: string; podcastName: string; kind?: SubmitUrlLookupKind }
  | { known: false; kind: SubmitUrlLookupKind; ambiguous?: false }
  | { known: false; ambiguous: true; podcastIds: string[]; kind?: SubmitUrlLookupKind };
