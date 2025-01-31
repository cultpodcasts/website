import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Component } from '@angular/core';
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
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule]
})

export class DiscoverySubmitComponent {
  isAuthenticated: boolean = false;
  isSending: boolean = false;

  submitState: SubmitDiscoveryState = {
    hasErrors: false,
    erroredItems: [],
    allErrored: false,
    endpointError: false
  }

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<DiscoverySubmitComponent, SubmitDiscoveryState>,
    private auth: AuthServiceWrapper,
    private discoveryInfoSvc: DiscoveryInfoService) {
    auth.authService.isAuthenticated$.subscribe(x => this.isAuthenticated = x);
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
      this.isSending = true;
      var resp = await firstValueFrom<HttpResponse<SubmitDiscoveryResponse>>(
        this.http.post<SubmitDiscoveryResponse>(
          endpoint,
          { ids: data.documentIds, resultIds: data.resultIds },
          { headers: headers, observe: "response" }
        ));
      if (resp.status === 200) {
        console.log(resp.body);
        this.isSending = false;
        const episodeIds = resp.body?.results.filter(x => x.episodeId != null).map(x => x.episodeId!);
        let uniqueEpisodeIds = [...new Set(episodeIds)];
        this.submitState.episodeIds = uniqueEpisodeIds;
        if (resp.body?.errorsOccurred) {
          this.submitState.hasErrors = true;
          this.submitState.erroredItems = resp.body?.results.filter(x => x.message == "Error").map(x => x.discoveryItemId);
          const containsAll = (arr1: string[], arr2: string[]) => arr2.every(arr2Item => arr1.includes(arr2Item))
          const sameMembers = (arr1: string[], arr2: string[]) => containsAll(arr1, arr2) && containsAll(arr2, arr1);
          this.submitState.allErrored = sameMembers(this.submitState.erroredItems, data.resultIds);
        } else {
          this.discoveryInfoSvc.getDiscoveryInfo();
          this.close();
        }
      } else {
        this.isSending = false;
        this.submitState.endpointError = true;
      }
    } catch (error) {
      this.isSending = false;
      this.submitState.endpointError = true;
    }
  }

  close() {
    this.dialogRef.close(this.submitState);
  }
}
