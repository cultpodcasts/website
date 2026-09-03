export type SubmitUrlLookupKind = 'podcast-service' | 'streaming' | 'unrecognised';

export type SubmitUrlLookupResponse =
  | { known: true; podcastId: string; podcastName: string; kind?: SubmitUrlLookupKind }
  | {
      known: false;
      kind: SubmitUrlLookupKind;
      ambiguous?: false;
      /** Extracted series name for unknown streaming (adapter ShowName). Not a catalogue id. */
      podcastName?: string;
    }
  | { known: false; ambiguous: true; podcastIds: string[]; kind?: SubmitUrlLookupKind };
