export interface IShare {
  url: URL;
  shareMode: ShareMode;
}

export enum ShareMode {
    Unknown = 0,
    Text,
    Share
}