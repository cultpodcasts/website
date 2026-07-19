import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { ApiEpisode } from './api-episode.interface';
import { EpisodePost } from './episode-post.interface';

@Injectable({
  providedIn: 'root'
})
export class EpisodeUpdateService {
  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient
  ) { }

  async updateEpisode(podcastId: string, episodeId: string, changes: EpisodePost): Promise<void> {
    const headers = await this.getAuthHeaders();
    const episodeEndpoint = new URL(`/episode/${podcastId}/${episodeId}`, environment.api).toString();
    await firstValueFrom(this.http.post(episodeEndpoint, changes, { headers: headers }));
  }

  async fetchEpisode(episodeId: string): Promise<ApiEpisode> {
    const headers = await this.getAuthHeaders();
    const episodeEndpoint = new URL(`/episode/${episodeId}`, environment.api).toString();
    const episode = await firstValueFrom(this.http.get<ApiEpisode>(episodeEndpoint, { headers: headers }));
    return this.normalizeEpisode(episode);
  }

  async applyAndRefresh(episode: ApiEpisode, changes: EpisodePost): Promise<ApiEpisode> {
    const podcastId = episode.podcastId;
    if (!podcastId) {
      throw new Error('Episode podcastId is required for updates.');
    }
    await this.updateEpisode(podcastId, episode.id, changes);
    return this.fetchEpisode(episode.id);
  }

  async removeSubject(episode: ApiEpisode, subject: string): Promise<ApiEpisode> {
    const subjects = (episode.subjects ?? []).filter(x => x !== subject);
    return this.applyAndRefresh(episode, { subjects });
  }

  async removeGuest(episode: ApiEpisode, guestName: string): Promise<ApiEpisode> {
    const guests = this.getGuestNames(episode).filter(x => x !== guestName);
    return this.applyAndRefresh(episode, { guests });
  }

  async addGuest(episode: ApiEpisode, guestName: string): Promise<ApiEpisode> {
    const guests = this.getGuestNames(episode);
    if (guests.includes(guestName)) {
      return episode;
    }
    return this.applyAndRefresh(episode, { guests: [...guests, guestName] });
  }

  async toggleIgnored(episode: ApiEpisode, ignored?: boolean): Promise<ApiEpisode> {
    return this.applyAndRefresh(episode, { ignored: ignored ?? !episode.ignored });
  }

  async toggleRemoved(episode: ApiEpisode, removed?: boolean): Promise<ApiEpisode> {
    return this.applyAndRefresh(episode, { removed: removed ?? !episode.removed });
  }

  getGuestNames(episode: ApiEpisode): string[] {
    if (episode.guests?.length) {
      return [...episode.guests];
    }
    return episode.guestPeople?.map(x => x.name) ?? [];
  }

  replaceEpisode(episodes: ApiEpisode[] | undefined, updated: ApiEpisode): ApiEpisode[] | undefined {
    if (!episodes) {
      return episodes;
    }
    const index = episodes.findIndex(x => x.id === updated.id);
    if (index < 0) {
      return episodes;
    }
    return episodes.map((episode, i) => i === index ? updated : episode);
  }

  private async getAuthHeaders(): Promise<HttpHeaders> {
    const token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));
    return new HttpHeaders().set('Authorization', 'Bearer ' + token);
  }

  private normalizeEpisode(episode: ApiEpisode): ApiEpisode {
    return {
      ...episode,
      release: new Date(episode.release)
    };
  }
}
