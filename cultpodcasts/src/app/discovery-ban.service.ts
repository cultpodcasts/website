import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { DiscoveryResults } from './discovery-results.interface';

/** Podcast read model bound after the ban acknowledgement. */
export interface BannedPodcast {
  id: string;
  name?: string | null;
  removed?: boolean | null;
  youTubeChannelId?: string | null;
  spotifyId?: string | null;
  appleId?: number | null;
}

export interface DiscoveryBanRead {
  podcast: BannedPodcast;
  discovery: DiscoveryResults;
}

@Injectable({ providedIn: 'root' })
export class DiscoveryBanService {
  constructor(
    private http: HttpClient,
    private auth: AuthServiceWrapper
  ) { }

  /**
   * Command then queries. The ban POST is an empty 202. The podcast is loaded with GET and bound here.
   */
  async ban(resultId: string, includeHidden = false): Promise<DiscoveryBanRead> {
    const headers = await this.headers();
    const banUrl = new URL(`/discovery-curation/${encodeURIComponent(resultId)}/ban`, environment.api);
    const acknowledged = await firstValueFrom(this.http.post(banUrl.toString(), null, {
      headers,
      observe: 'response',
      responseType: 'text'
    }));
    if (acknowledged.status !== 202) {
      throw new Error('Remove was not acknowledged.');
    }

    const discoveryUrl = new URL('/discovery-curation', environment.api);
    if (includeHidden) {
      discoveryUrl.searchParams.set('includeHidden', 'true');
    }
    const discovery = await firstValueFrom(this.http.get<DiscoveryResults>(discoveryUrl.toString(), { headers }));
    const podcastId = discovery.results
      .find(result => result.id === resultId)
      ?.matchingPodcasts
      ?.find(podcast => !!podcast.id)
      ?.id;
    if (!podcastId) {
      throw new Error('Removed podcast was not on the discovery results.');
    }

    const podcastUrl = new URL(`/podcast/${encodeURIComponent(podcastId)}`, environment.api);
    const podcast = await firstValueFrom(this.http.get<BannedPodcast>(podcastUrl.toString(), { headers }));
    if (podcast.removed !== true) {
      throw new Error('Podcast was not removed.');
    }
    return { podcast, discovery };
  }

  private async headers(): Promise<HttpHeaders> {
    const token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: 'https://api.cultpodcasts.com/',
        scope: 'curate'
      }
    }));
    return new HttpHeaders().set('Authorization', 'Bearer ' + token);
  }
}
