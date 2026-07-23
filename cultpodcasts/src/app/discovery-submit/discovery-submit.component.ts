import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { DiscoverySubmit } from '../discovery-submit.interface';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { SubmitDiscoveryResponse } from '../submit-discovery-response.interface';
import { SubmitDiscoveryState } from '../submit-discovery-state.interface';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DiscoveryInfoService } from '../discovery-info.service';

@Component({
  selector: 'app-discovery-submit',
  templateUrl: './discovery-submit.component.html',
  styleUrls: ['./discovery-submit.component.sass'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule]
})

export class DiscoverySubmitComponent {
  isSending = signal(false);

  submitState = signal<SubmitDiscoveryState>({
    hasErrors: false,
    erroredItems: [],
    allErrored: false,
    endpointError: false
  });

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<DiscoverySubmitComponent, SubmitDiscoveryState>,
    private auth: AuthServiceWrapper,
    private discoveryInfoSvc: DiscoveryInfoService) {
  }

  public async submit(data: DiscoverySubmit) {
    try {
      var token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
        authorizationParams: {
          audience: `https://api.cultpodcasts.com/`,
          scope: 'curate'
        }
      }));
      if (token === "") {
        throw new Error("Unable to get access-token");
      }
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + token);
      const endpoint = new URL("/discovery-curation", environment.api).toString();
      this.isSending.set(true);
      var resp = await firstValueFrom<HttpResponse<SubmitDiscoveryResponse>>(
        this.http.post<SubmitDiscoveryResponse>(
          endpoint,
          { ids: data.documentIds, resultIds: data.resultIds },
          { headers: headers, observe: "response" }
        ));
      if (resp.status === 200) {
        this.isSending.set(false);
        const podcastEpisodeIds = (resp.body?.results ?? [])
          .filter(x => x.podcastId != null && x.episodeId != null)
          .map(x => `${x.podcastId!}/${x.episodeId!}`);
        const uniquePodcastEpisodeIds = [...new Set(podcastEpisodeIds)];
        if (resp.body?.errorsOccurred) {
          const erroredItems = resp.body?.results.filter(x => x.message == "Error").map(x => x.discoveryItemId);
          const containsAll = (arr1: string[], arr2: string[]) => arr2.every(arr2Item => arr1.includes(arr2Item))
          const sameMembers = (arr1: string[], arr2: string[]) => containsAll(arr1, arr2) && containsAll(arr2, arr1);
          const allErrored = sameMembers(erroredItems, data.resultIds);
          this.submitState.update(s => ({
            ...s,
            episodeIds: uniquePodcastEpisodeIds,
            hasErrors: true,
            erroredItems,
            allErrored
          }));
        } else {
          this.submitState.update(s => ({ ...s, episodeIds: uniquePodcastEpisodeIds }));
          this.discoveryInfoSvc.getDiscoveryInfo();
          this.close();
        }
      } else {
        this.isSending.set(false);
        this.submitState.update(s => ({ ...s, endpointError: true }));
      }
    } catch (error) {
      this.isSending.set(false);
      this.submitState.update(s => ({ ...s, endpointError: true }));
    }
  }

  close() {
    this.dialogRef.close(this.submitState());
  }
}
