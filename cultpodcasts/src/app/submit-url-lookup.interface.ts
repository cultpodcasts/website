export type SubmitUrlLookupKind = 'podcast-service' | 'streaming' | 'unrecognised';

/** Streaming ServiceKeys — aligned with Api streamingServiceKeySchema / RPP ServiceKeys. */
export type SubmitUrlStreamingService =
  | 'bbcSounds'
  | 'bbcIplayer'
  | 'internetArchive'
  | 'vimeo'
  | 'netflix'
  | 'amazonPrime'
  | 'paramountPlus'
  | 'hboMax'
  | 'playSuisse'
  | 'tvnzPlus'
  | 'itvx'
  | 'channel4'
  | 'fawesome'
  | 'disneyPlus'
  | 'discoveryPlus';

export type SubmitUrlLookupResponse =
  | {
      known: true;
      podcastId: string;
      podcastName: string;
      kind?: SubmitUrlLookupKind;
      /** Present when kind is streaming. */
      service?: SubmitUrlStreamingService;
    }
  | {
      known: false;
      kind: SubmitUrlLookupKind;
      ambiguous?: false;
      /** Extracted series name for unknown streaming (adapter ShowName). Not a catalogue id. */
      podcastName?: string;
      service?: SubmitUrlStreamingService;
    }
  | {
      known: false;
      ambiguous: true;
      podcastIds: string[];
      kind?: SubmitUrlLookupKind;
      service?: SubmitUrlStreamingService;
    };
