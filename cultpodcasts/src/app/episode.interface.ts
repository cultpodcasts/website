export interface Episode {
    id: string;
    podcastName: string;
    episodeTitle: string;
    episodeDescription: string;
    release: Date;
    duration: string;
    spotify: URL | undefined;
    apple: URL | undefined;
    youtube: URL | undefined;
    bbc: URL | undefined;
    internetArchive: URL | undefined;
    subjects: string[] | undefined;
    image: URL | undefined;
  }
