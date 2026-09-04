import type { StreamingServiceKey } from './streaming-submit-contract';

export type SubmitUrlLookupKind = 'podcast-service' | 'streaming' | 'unrecognised';

/**
 * Streaming ServiceKeys — alias of the Api contract type.
 * Do not duplicate the literal list; extend the fixture and re-copy.
 */
export type SubmitUrlStreamingService = StreamingServiceKey;

type NonStreamingLookupKind = Exclude<SubmitUrlLookupKind, 'streaming'>;

/**
 * Lookup 200 body. Streaming arms require `service` (Api membership wire).
 * Podcast-service / unrecognised arms omit `service`.
 */
export type SubmitUrlLookupResponse =
  | {
      known: true;
      podcastId: string;
      podcastName: string;
      kind: 'streaming';
      service: SubmitUrlStreamingService;
    }
  | {
      known: false;
      kind: 'streaming';
      ambiguous?: false;
      /** Extracted series name for unknown streaming (adapter ShowName). Not a catalogue id. */
      podcastName?: string | null;
      service: SubmitUrlStreamingService;
    }
  | {
      known: false;
      ambiguous: true;
      podcastIds: string[];
      kind: 'streaming';
      service: SubmitUrlStreamingService;
    }
  | {
      known: true;
      podcastId: string;
      podcastName: string;
      kind?: NonStreamingLookupKind;
    }
  | {
      known: false;
      kind: NonStreamingLookupKind;
      ambiguous?: false;
      podcastName?: string;
    }
  | {
      known: false;
      ambiguous: true;
      podcastIds: string[];
      kind?: NonStreamingLookupKind;
    };
