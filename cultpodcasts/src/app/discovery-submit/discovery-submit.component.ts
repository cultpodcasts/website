import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { DISCOVERY_SUBMIT_SCOPE, describeSubmissionError } from '../discovery-supervision/discovery-supervision';
import { DiscoverySubmissionHeld } from '../discovery-supervision/discovery-supervision.models';
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MatDialog, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { DiscoverySubmit } from '../discovery-submit.interface';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { SubmitDiscoveryResponse } from '../submit-discovery-response.interface';
import { SubmitDiscoveryState } from '../submit-discovery-state.interface';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DiscoveryInfoService } from '../discovery-info.service';
import { UnsupportedLanguageAnswer } from '../unsupported-language-dialog/unsupported-language-dialog.component';
import {
  promptAmbiguousIdentities,
  promptUnsupportedLanguages
} from '../submit-language-identity-prompts';

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
    private discoveryInfoSvc: DiscoveryInfoService,
    private dialog: MatDialog) {
  }

  public async submit(data: DiscoverySubmit) {
    try {
      var token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
        authorizationParams: {
          audience: `https://api.cultpodcasts.com/`,
          scope: DISCOVERY_SUBMIT_SCOPE
        }
      }));
      if (token === "") {
        throw new Error("Unable to get access-token");
      }
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + token);
      const endpoint = new URL("/discovery-curation", environment.api).toString();
      this.isSending.set(true);
      let resultIds = data.resultIds;
      let languageDecisions: Record<string, UnsupportedLanguageAnswer> | undefined;
      let identityDecisions: Record<string, 'select' | 'continue'> | undefined;
      let selectedIdentityKeys: Record<string, string> | undefined;
      var resp = await firstValueFrom<HttpResponse<SubmitDiscoveryResponse | DiscoverySubmissionHeld>>(
        this.http.post<SubmitDiscoveryResponse | DiscoverySubmissionHeld>(
          endpoint,
          { ids: data.documentIds, resultIds },
          { headers: headers, observe: "response" }
        ));
      if (resp.status === 200) {
        const prompted = resp.body as SubmitDiscoveryResponse | null;
        const required = prompted?.languageDecisionsRequired ?? [];
        if (required.length > 0) {
          const language = await promptUnsupportedLanguages(this.dialog, required, resultIds);
          resultIds = language.idsToCreate;
          if (resultIds.length === 0) {
            this.isSending.set(false);
            return;
          }
          languageDecisions = language.languageDecisions;
          resp = await firstValueFrom<HttpResponse<SubmitDiscoveryResponse | DiscoverySubmissionHeld>>(
            this.http.post<SubmitDiscoveryResponse | DiscoverySubmissionHeld>(
              endpoint,
              { ids: data.documentIds, resultIds, languageDecisions },
              { headers: headers, observe: "response" }
            ));
        }
      }
      if (resp.status === 200) {
        const prompted = resp.body as SubmitDiscoveryResponse | null;
        const required = prompted?.identityDecisionsRequired ?? [];
        if (required.length > 0) {
          const identity = await promptAmbiguousIdentities(this.dialog, required, resultIds);
          resultIds = identity.idsToCreate;
          if (resultIds.length === 0) {
            this.isSending.set(false);
            return;
          }
          identityDecisions = identity.identityDecisions;
          selectedIdentityKeys = identity.selectedIdentityKeys;
          resp = await firstValueFrom<HttpResponse<SubmitDiscoveryResponse | DiscoverySubmissionHeld>>(
            this.http.post<SubmitDiscoveryResponse | DiscoverySubmissionHeld>(
              endpoint,
              {
                ids: data.documentIds,
                resultIds,
                ...(languageDecisions ? { languageDecisions } : {}),
                identityDecisions,
                ...(Object.keys(selectedIdentityKeys).length > 0 ? { selectedIdentityKeys } : {})
              },
              { headers: headers, observe: "response" }
            ));
        }
      }
      if (resp.status === 202) {
        // Supervised curator: held for supervisor review; nothing was ingested.
        const held = resp.body as DiscoverySubmissionHeld | null;
        this.isSending.set(false);
        this.submitState.update(s => ({ ...s, heldSubmissionId: held?.submissionId ?? '' }));
        this.discoveryInfoSvc.getDiscoveryInfo();
        this.close();
      } else if (resp.status === 200) {
        this.isSending.set(false);
        const body = resp.body as SubmitDiscoveryResponse | null;
        const podcastEpisodeIds = (body?.results ?? [])
          .filter(x => x.podcastId != null && x.episodeId != null)
          .map(x => `${x.podcastId!}/${x.episodeId!}`);
        const uniquePodcastEpisodeIds = [...new Set(podcastEpisodeIds)];
        if (body?.errorsOccurred) {
          const erroredItems = body.results.filter(x => x.message == "Error").map(x => x.discoveryItemId);
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
      this.submitState.update(s => ({ ...s, endpointError: true, errorMessage: describeSubmissionError(error) }));
    }
  }

  close() {
    this.dialogRef.close(this.submitState());
  }
}
