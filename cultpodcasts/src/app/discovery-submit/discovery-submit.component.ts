import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { DISCOVERY_SUBMIT_SCOPE, describeSubmissionError } from '../discovery-supervision/discovery-supervision';
import { DiscoverySubmissionHeld } from '../discovery-supervision/discovery-supervision.models';
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MatDialog, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { DiscoverySubmit } from '../discovery-submit.interface';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { DiscoveryIdentityDecision, DiscoveryLanguageDecision, SubmitDiscoveryResponse } from '../submit-discovery-response.interface';
import { SubmitDiscoveryState } from '../submit-discovery-state.interface';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DiscoveryInfoService } from '../discovery-info.service';
import { UnsupportedLanguageAnswer, UnsupportedLanguageDialogComponent, UnsupportedLanguagePrompt } from '../unsupported-language-dialog/unsupported-language-dialog.component';
import { AmbiguousIdentityAnswer, AmbiguousIdentityDialogComponent, AmbiguousIdentityPrompt } from '../ambiguous-identity-dialog/ambiguous-identity-dialog.component';

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
          const answers = await this.askLanguages(required);
          const promptedIds = new Set(required.map(item => item.discoveryItemId));
          const creating = required
            .map(item => ({ id: item.discoveryItemId, answer: answers.get(item.discoveryItemId) }))
            .filter(item => item.answer === 'add' || item.answer === 'continue');
          const untouched = data.resultIds.filter(id => !promptedIds.has(id));
          resultIds = [...untouched, ...creating.map(item => item.id)];
          if (resultIds.length === 0) {
            this.isSending.set(false);
            return;
          }
          languageDecisions = Object.fromEntries(creating.map(item => [item.id, item.answer!]));
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
          const answers = await this.askIdentities(required);
          const promptedIds = new Set(required.map(item => item.discoveryItemId));
          const creating = required
            .map(item => ({ id: item.discoveryItemId, answer: answers.get(item.discoveryItemId) }))
            .filter(item => item.answer?.decision === 'select' || item.answer?.decision === 'continue');
          const untouched = resultIds.filter(id => !promptedIds.has(id));
          resultIds = [...untouched, ...creating.map(item => item.id)];
          if (resultIds.length === 0) {
            this.isSending.set(false);
            return;
          }
          identityDecisions = Object.fromEntries(
            creating.map(item => [item.id, item.answer!.decision as 'select' | 'continue']));
          selectedIdentityKeys = Object.fromEntries(
            creating
              .filter(item => item.answer?.decision === 'select')
              .map(item => {
                const selected = item.answer as { decision: 'select'; key: string };
                return [item.id, selected.key];
              }));
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

  private async askLanguages(required: DiscoveryLanguageDecision[]) {
    const answers = new Map<string, UnsupportedLanguageAnswer>();
    for (const item of required) {
      const answer = await firstValueFrom(this.dialog.open<
        UnsupportedLanguageDialogComponent,
        UnsupportedLanguagePrompt,
        UnsupportedLanguageAnswer>(
          UnsupportedLanguageDialogComponent,
          {
            data: { code: item.code, name: item.name, signals: item.signals },
            disableClose: true,
            autoFocus: true,
            width: '36rem'
          }
        ).afterClosed());
      answers.set(item.discoveryItemId, answer === 'add' || answer === 'continue' ? answer : 'cancel');
    }
    return answers;
  }

  private async askIdentities(required: DiscoveryIdentityDecision[]) {
    const answers = new Map<string, AmbiguousIdentityAnswer>();
    for (const item of required) {
      const answer = await firstValueFrom(this.dialog.open<
        AmbiguousIdentityDialogComponent,
        AmbiguousIdentityPrompt,
        AmbiguousIdentityAnswer>(
          AmbiguousIdentityDialogComponent,
          {
            data: { target: item.target, query: item.query, candidates: item.candidates },
            disableClose: true,
            autoFocus: true,
            width: '36rem'
          }
        ).afterClosed());
      answers.set(
        item.discoveryItemId,
        answer?.decision === 'select' || answer?.decision === 'continue'
          ? answer
          : { decision: 'cancel' });
    }
    return answers;
  }
}
