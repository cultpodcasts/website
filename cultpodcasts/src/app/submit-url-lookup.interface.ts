import type { StreamingServiceKey } from './streaming-submit-contract';
import type { CataloguePlayableKind } from './catalogue-playable-kind.enum';

export type SubmitUrlLookupKind = 'podcast-service' | 'streaming' | 'unrecognised';

/**
 * Streaming ServiceKeys — alias of the Api contract type.
 * Do not duplicate the literal list; extend the fixture and re-copy.
 */
export type SubmitUrlStreamingService = StreamingServiceKey;

type NonStreamingLookupKind = Exclude<SubmitUrlLookupKind, 'streaming'>;

type SubmitUrlLookupCatalogueFields = {
  /** Playable kind when the URL is already in the catalogue (Film / TV / News / Episode). */
  contentKind?: CataloguePlayableKind | null;
  /** Parent show / outlet name for TV / News; omitted for Film. */
  parentName?: string | null;
};

/**
 * Optional refuse fields (website #650 / RPP #1358). Older Api omits them.
 * Rejected BBC News lookup: known false, kind unrecognised, contentKind NewsReport.
 */
export type SubmitUrlLookupRejectionFields = {
  rejected?: boolean;
  message?: string;
  /** Present on some rejected / catalogue bodies; optional for older Api. */
  contentKind?: CataloguePlayableKind | null;
};

/**
 * Lookup 200 body. Streaming arms require `service` (Api membership wire).
 * Podcast-service / unrecognised arms omit `service`.
 * Known Film / TV / News may omit `podcastId` / `podcastName`.
 */
type SubmitUrlLookupResponseBody =
  | ({
      known: true;
      podcastId?: string | null;
      podcastName?: string | null;
      kind: 'streaming';
      service: SubmitUrlStreamingService;
    } & SubmitUrlLookupCatalogueFields)
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
  | ({
      known: true;
      podcastId?: string | null;
      podcastName?: string | null;
      kind?: NonStreamingLookupKind;
    } & SubmitUrlLookupCatalogueFields)
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

export type SubmitUrlLookupResponse = SubmitUrlLookupResponseBody & SubmitUrlLookupRejectionFields;
