import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, WritableSignal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { ApiEpisode } from './api-episode.interface';
import { EpisodePost } from './episode-post.interface';
import { EpisodePublishResponse } from './episode-publish-response.interface';
import { PostEpisodeModel } from './post-episode-model.interface';
import { AUTH_SCOPE } from './auth.interceptor';
import { isNonPodcastPlayableKind } from './catalogue-playable-kind.enum';

/** The podcast a review-page edit-podcast dialog saved (id when the card had one, else its name). */
export interface SavedPodcastRef {
  podcastId?: string;
  podcastName?: string;
}

/**
 * Podcast-episode cards that belong to the saved podcast. News / TV / film rows never match (their parent is
 * not a podcast). Matches on `podcastId` when the dialog knew it, otherwise on the podcast name.
 * Over-matching on the name fallback (a same-named podcast) is harmless by design: a match only triggers a
 * read-only GET whose body is the server's current state, so do not tighten this in a way that misses siblings.
 */
export function isCardOfPodcast(episode: ApiEpisode, podcast: SavedPodcastRef): boolean {
  if (isNonPodcastPlayableKind(episode.contentKind)) {
    return false;
  }
  if (podcast.podcastId) {
    return episode.podcastId === podcast.podcastId;
  }
  return !!podcast.podcastName && episode.podcastName === podcast.podcastName;
}

/**
 * The review page's inline edits (subjects, guests, ignored / removed / tweeted, unBluesky, language) in the
 * playable PATCH shape: same names except the episode `lang` is `language`. Service URLs / images are not sent.
 */
export function toPlayableChanges(changes: EpisodePost): Record<string, unknown> {
  const { lang, urls: _urls, images: _images, services: _services, ...rest } = changes as EpisodePost & Record<string, unknown>;
  const body: Record<string, unknown> = { ...rest };
  if (lang !== undefined) {
    body['language'] = lang;
  }
  return body;
}

@Injectable({
  providedIn: 'root'
})
export class EpisodeUpdateService {
  constructor(
    private http: HttpClient
  ) { }

  async updateEpisode(podcastId: string, episodeId: string, changes: EpisodePost): Promise<void> {
    const episodeEndpoint = new URL(`/episode/${podcastId}/${episodeId}`, environment.api).toString();
    await firstValueFrom(this.http.patch(episodeEndpoint, changes, { context: this.curateContext() }));
  }

  async fetchEpisode(episodeId: string): Promise<ApiEpisode> {
    const episodeEndpoint = new URL(`/episode/${episodeId}`, environment.api).toString();
    const episode = await firstValueFrom(this.http.get<ApiEpisode>(episodeEndpoint, { context: this.curateContext() }));
    return this.normalizeEpisode(episode);
  }

  /**
   * News / TV / film rows (GET /episode/{id} returns `contentKind` for every kind) PATCH their own route:
   * PATCH /episode only edits podcast episodes.
   */
  playablePatchPath(episode: Pick<ApiEpisode, 'id' | 'contentKind'>): string | null {
    const id = encodeURIComponent(episode.id);
    switch (episode.contentKind) {
      case 'NewsReport':
        return `/newsreport/${id}`;
      case 'TvShowEpisode':
        return `/tvshowepisode/${id}`;
      case 'Film':
        return `/film/${id}`;
      default:
        return null;
    }
  }

  async applyAndRefresh(episode: ApiEpisode, changes: EpisodePost): Promise<ApiEpisode> {
    const playablePath = this.playablePatchPath(episode);
    if (playablePath) {
      const endpoint = new URL(playablePath, environment.api).toString();
      await firstValueFrom(this.http.patch(endpoint, toPlayableChanges(changes), { context: this.curateContext() }));
      return this.fetchEpisode(episode.id);
    }
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
    return this.applyAndRefresh(episode, { unBluesky: true });
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

  /**
   * After an edit-podcast save, GET every card of that podcast again. The podcast PUT moves episodes that
   * followed the old default language onto the new one server-side (episodes with their own language keep it),
   * so the re-read bodies carry the inherited language flag without a page Refresh. A card whose GET fails is
   * left out (it keeps its current body); the rest still update.
   */
  async fetchPodcastEpisodes(episodes: readonly ApiEpisode[] | undefined, podcast: SavedPodcastRef): Promise<ApiEpisode[]> {
    const ids = [...new Set((episodes ?? []).filter(x => isCardOfPodcast(x, podcast)).map(x => x.id))];
    const results = await Promise.allSettled(ids.map(id => this.fetchEpisode(id)));
    const updated: ApiEpisode[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        updated.push(result.value);
      } else {
        console.error(result.reason);
      }
    }
    return updated;
  }

  /**
   * Re-read the saved podcast's cards (`fetchPodcastEpisodes`) and bind the GET bodies into `episodes`. Race-safe:
   * a card is only replaced when the list still holds the exact object its GET was started for and the card is
   * not mid-update, so a newer inline edit, a Refresh / reload or a later podcast save is never overwritten by
   * an older read.
   */
  async refreshPodcastCards(
    episodes: WritableSignal<ApiEpisode[] | undefined>,
    podcast: SavedPodcastRef,
    isUpdating: (episodeId: string) => boolean = () => false
  ): Promise<void> {
    try {
      const startedFor = new Set((episodes() ?? []).filter(x => isCardOfPodcast(x, podcast)));
      const fresh = new Map((await this.fetchPodcastEpisodes([...startedFor], podcast)).map(x => [x.id, x]));
      const current = episodes();
      if (!current || fresh.size === 0) {
        return;
      }
      let changed = false;
      const next = current.map(card => {
        const body = fresh.get(card.id);
        if (!body || !startedFor.has(card) || isUpdating(card.id)) {
          return card;
        }
        changed = true;
        return body;
      });
      if (changed) {
        episodes.set(next);
      }
    } catch (e) {
      console.error(e);
    }
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
