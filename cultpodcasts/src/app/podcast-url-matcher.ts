const spotify = /^(?:https?:)?\/\/open\.spotify\.com\/episode\/[A-Za-z\d]+/;
const youtube = /^(?:https?:\/\/)?(?:(?:www\.)?youtube\.com\/(?:watch\?v=|live\/|shorts\/)|youtu\.be\/)[A-Za-z\d\-\_]+/;
const apple = /^(?:https?:)?\/\/podcasts\.apple\.com\/(\w+\/)?podcast\/[a-z\-0-9]+\/id\d+\?i=\d+/;
const bbc = /^(?:https?:)?\/\/www\.bbc\.co\.uk\/((iplayer\/episode\/[\w]+\/[A-Za-z\d\-_]+)|(sounds\/play\/[\w]+))/;
const internetArchive = /^(?:https?:)?\/\/archive\.org\/details\/[A-Za-z\d\-_\.]+/;

const patterns = [
  { regex: spotify, useFullInput: false },
  { regex: youtube, useFullInput: false },
  { regex: apple, useFullInput: false },
  { regex: bbc, useFullInput: false },
  { regex: internetArchive, useFullInput: true },
];

export function isSubmittablePodcastUrl(input: string): boolean {
  return parseSubmittablePodcastUrl(input) != null;
}

export function parseSubmittablePodcastUrl(input: string): URL | undefined {
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
      return new URL(matchedUrl);
    } catch {
      if (!/^\w+\:\/\//.test(matchedUrl)) {
        try {
          return new URL(`https://${matchedUrl}`);
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
