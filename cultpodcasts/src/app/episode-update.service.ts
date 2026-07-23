import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { ApiEpisode } from './api-episode.interface';
import { EpisodePost } from './episode-post.interface';
import { EpisodePublishResponse } from './episode-publish-response.interface';
import { PostEpisodeModel } from './post-episode-model.interface';
import { AUTH_SCOPE } from './auth.interceptor';

@Injectable({
  providedIn: 'root'
})
export class EpisodeUpdateService {
  constructor(
    private http: HttpClient
  ) { }

  async updateEpisode(podcastId: string, episodeId: string, changes: EpisodePost): Promise<void> {
    const episodeEndpoint = new URL(`/episode/${podcastId}/${episodeId}`, environment.api).toString();
    await firstValueFrom(this.http.post(episodeEndpoint, changes, { context: this.curateContext() }));
  }

  async fetchEpisode(episodeId: string): Promise<ApiEpisode> {
    const episodeEndpoint = new URL(`/episode/${episodeId}`, environment.api).toString();
    const episode = await firstValueFrom(this.http.get<ApiEpisode>(episodeEndpoint, { context: this.curateContext() }));
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

  async setGuests(episode: ApiEpisode, guests: string[]): Promise<ApiEpisode> {
    return this.applyAndRefresh(episode, { guests });
  }

  async toggleIgnored(episode: ApiEpisode, ignored?: boolean): Promise<ApiEpisode> {
    const next = ignored ?? !episode.ignored;
    const changes: EpisodePost = { ignored: next };
    if (next) {
      changes.removed = false;
    }
    return this.applyAndRefresh(episode, changes);
  }

  async toggleRemoved(episode: ApiEpisode, removed?: boolean): Promise<ApiEpisode> {
    const next = removed ?? !episode.removed;
    const changes: EpisodePost = { removed: next };
    if (next) {
      changes.ignored = false;
    }
    return this.applyAndRefresh(episode, changes);
  }

  async markTweeted(episode: ApiEpisode): Promise<ApiEpisode> {
    return this.applyAndRefresh(episode, { tweeted: true });
  }

  async untweet(episode: ApiEpisode): Promise<ApiEpisode> {
    return this.applyAndRefresh(episode, { tweeted: false });
  }

  /** Attempt auto-tweet via publish; 400 bodies with failedTweetContent enable the manual-tweet dialog. */
  async publishTweet(episode: ApiEpisode): Promise<EpisodePublishResponse> {
    const podcastId = episode.podcastId;
    if (!podcastId) {
      throw new Error('Episode podcastId is required for updates.');
    }
    const endpoint = new URL(`/episode/publish/${podcastId}/${episode.id}`, environment.api).toString();
    const body: PostEpisodeModel = { tweet: true };
    try {
      return await firstValueFrom(
        this.http.post<EpisodePublishResponse>(endpoint, body, { context: this.curateContext() })
      );
    } catch (e: unknown) {
      const err = e as { status?: number; error?: EpisodePublishResponse };
      if (err.status === 400 && err.error) {
        return err.error;
      }
      throw e;
    }
  }

  async postBluesky(episode: ApiEpisode): Promise<ApiEpisode> {
    const podcastId = episode.podcastId;
    if (!podcastId) {
      throw new Error('Episode podcastId is required for updates.');
    }
    const endpoint = new URL(`/episode/publish/${podcastId}/${episode.id}`, environment.api).toString();
    const body: PostEpisodeModel = { blueskyPost: true };
    const response = await firstValueFrom(
      this.http.post<EpisodePublishResponse>(endpoint, body, { context: this.curateContext() })
    );
    if (!response.blueskyPosted) {
      throw new Error('Bluesky post failed.');
    }
    return this.fetchEpisode(episode.id);
  }

  async unpostBluesky(episode: ApiEpisode): Promise<ApiEpisode> {
    return this.applyAndRefresh(episode, { bluesky: false });
  }

  async toggleBluesky(episode: ApiEpisode): Promise<ApiEpisode> {
    return episode.bluesky ? this.unpostBluesky(episode) : this.postBluesky(episode);
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

  private curateContext(): HttpContext {
    return new HttpContext().set(AUTH_SCOPE, 'curate');
  }

  private normalizeEpisode(episode: ApiEpisode): ApiEpisode {
    return {
      ...episode,
      release: new Date(episode.release)
    };
  }
}
