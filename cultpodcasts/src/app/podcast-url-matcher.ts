const spotify = /^(?:https?:)?\/\/open\.spotify\.com\/episode\/[A-Za-z\d]+/;
const youtube = /^(?:https?:\/\/)?(?:(?:www\.)?youtube\.com\/(?:watch\?v=|live\/|shorts\/)|youtu\.be\/)[A-Za-z\d\-\_]+/;
const apple = /^(?:https?:)?\/\/podcasts\.apple\.com\/(\w+\/)?podcast\/[a-z\-0-9]+\/id\d+\?i=\d+/;
const bbc = /^(?:https?:)?\/\/www\.bbc\.co\.uk\/((iplayer\/episode\/[\w]+\/[A-Za-z\d\-_]+)|(sounds\/play\/[\w]+))/;
const internetArchive = /^(?:https?:)?\/\/archive\.org\/details\/[A-Za-z\d\-_\.]+/;
const vimeo = /^(?:https?:)?\/\/(?:(?:www|player)\.)?vimeo\.com\/(?:video\/)?(?:channels\/[^/]+\/)?(\d+)(?:\/[A-Za-z\d]+)?/;
const netflix = /^(?:https?:)?\/\/(?:www\.)?netflix\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:title|watch)\/\d+/;
const amazonPrime = /^(?:https?:)?\/\/(?:www\.)?(?:primevideo\.com\/(?:region\/[^/]+\/)?(?:detail\/[A-Za-z0-9]+|gp\/video(?:\/detail\/[A-Za-z0-9]+)?)|(?:amazon\.com|amazon\.co\.uk)\/(?:gp\/video(?:\/detail\/[A-Za-z0-9]+)?|(?:Prime-Video|prime-video)(?:\/detail\/[A-Za-z0-9]+)?))/;
const itvx = /^(?:https?:)?\/\/(?:www\.)?itv\.com\/watch\/(?!news\/)[^/\s]+\/[^/\s]+/;
const channel4 = /^(?:https?:)?\/\/(?:www\.)?(?:channel4|all4)\.com\/programmes\/[^/\s]+(?:\/on-demand\/[^/\s]+)?\/?$/;
const fawesome = /^(?:https?:)?\/\/(?:www\.)?fawesome\.tv\/(?:movies|tv-shows|tv|shows)\/\d+/;
const paramountPlus = /^(?:https?:)?\/\/(?:www\.)?paramountplus\.com\/(?:[a-z]{2}\/)?(?:shows|movies|video)\/[^/\s]+/;
const hboMax = /^(?:https?:)?\/\/(?:(?:www|play)\.)?(?:max|hbomax)\.com\/(?:shows?|movies?|series)\/[^/\s]+/;
const playSuisse = /^(?:https?:)?\/\/(?:www\.)?playsuisse\.ch\/(?:[a-z]{2}\/)?(?:watch|detail)\/\d+/;
const tvnzPlus = /^(?:https?:)?\/\/(?:www\.)?tvnz\.co\.nz\/shows\/[^/\s]+/;
const disneyPlus = /^(?:https?:)?\/\/(?:www\.)?disneyplus\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:browse\/entity-[^/\s]+|(?:series|movies|play)\/[^/\s]+)/;
const discoveryPlus = /^(?:https?:)?\/\/(?:www\.)?discoveryplus\.com\/(?:[a-z]{2}\/)?(?:show|video|movie)\/[^/\s]+/;

export type SubmittablePodcastUrlKind = 'podcast-service' | 'streaming';

const patterns: { regex: RegExp; useFullInput: boolean; kind: SubmittablePodcastUrlKind }[] = [
  { regex: spotify, useFullInput: false, kind: 'podcast-service' },
  { regex: youtube, useFullInput: false, kind: 'podcast-service' },
  { regex: apple, useFullInput: false, kind: 'podcast-service' },
  { regex: bbc, useFullInput: false, kind: 'streaming' },
  { regex: internetArchive, useFullInput: true, kind: 'streaming' },
  { regex: vimeo, useFullInput: false, kind: 'streaming' },
  { regex: netflix, useFullInput: false, kind: 'streaming' },
  { regex: amazonPrime, useFullInput: true, kind: 'streaming' },
  { regex: itvx, useFullInput: true, kind: 'streaming' },
  { regex: channel4, useFullInput: true, kind: 'streaming' },
  { regex: fawesome, useFullInput: true, kind: 'streaming' },
  { regex: paramountPlus, useFullInput: true, kind: 'streaming' },
  { regex: hboMax, useFullInput: true, kind: 'streaming' },
  { regex: playSuisse, useFullInput: true, kind: 'streaming' },
  { regex: tvnzPlus, useFullInput: true, kind: 'streaming' },
  { regex: disneyPlus, useFullInput: true, kind: 'streaming' },
  { regex: discoveryPlus, useFullInput: true, kind: 'streaming' },
];

export function isSubmittablePodcastUrl(input: string): boolean {
  return parseSubmittablePodcastUrl(input) != null;
}

export function classifySubmittablePodcastUrl(input: string): SubmittablePodcastUrlKind | undefined {
  return matchSubmittablePodcastUrl(input)?.kind;
}

export function parseSubmittablePodcastUrl(input: string): URL | undefined {
  return matchSubmittablePodcastUrl(input)?.url;
}

function matchSubmittablePodcastUrl(input: string): { url: URL; kind: SubmittablePodcastUrlKind } | undefined {
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }

  for (const pattern of patterns) {
    if (!pattern.regex.test(trimmed)) {
      continue;
    }

    const matchedUrl = pattern.useFullInput ? trimmed : trimmed.match(pattern.regex)?.[0];
    if (!matchedUrl) {
      continue;
    }

    try {
      return { url: new URL(matchedUrl), kind: pattern.kind };
    } catch {
      if (!/^\w+\:\/\//.test(matchedUrl)) {
        try {
          return { url: new URL(`https://${matchedUrl}`), kind: pattern.kind };
        } catch {
          return undefined;
        }
      }
    }
  }

  return undefined;
}

export function extractUrlFromDataTransfer(dataTransfer: DataTransfer): string | undefined {
  const uriList = dataTransfer.getData('text/uri-list') || dataTransfer.getData('URL');
  if (uriList) {
    const candidate = uriList.split('\n').map(line => line.trim()).find(line => line && !line.startsWith('#'));
    if (candidate) {
      return candidate;
    }
  }

  const plain = dataTransfer.getData('text/plain').trim();
  if (!plain) {
    return undefined;
  }

  const embedded = plain.match(/https?:\/\/\S+/i);
  return embedded ? embedded[0].replace(/[),.]+$/, '') : plain;
}

export function urlsReferToSameEpisode(a: URL, b: URL): boolean {
  const normalizedA = parseSubmittablePodcastUrl(a.toString());
  const normalizedB = parseSubmittablePodcastUrl(b.toString());
  if (!normalizedA || !normalizedB) {
    return a.toString() === b.toString();
  }
  return normalizedA.toString() === normalizedB.toString();
}
