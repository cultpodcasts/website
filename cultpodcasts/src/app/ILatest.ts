import { IEpisode } from './IEpisode';


export interface ILatest {
  counts: [{ Table: string; Count: number; }];
  latest: IEpisode[];
}
