import { HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { Share } from '../share.interface';
import { ShareMode } from "../share-mode.enum";
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { environment } from './../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SubmitDialogResponse } from '../submit-dialog-response.interface';
import { SubmitUrlOriginResponse } from "../submit-url-origin-response.interface";
import { parseSubmittablePodcastUrl } from '../podcast-url-matcher';
import { resolveSubmitNameConflict } from '../submit-series-conflict';
import { SubmitSeriesResolveService } from '../submit-series-resolve.service';
import { submitEpisodePostBody, submitParentPostBody } from '../submit-series.util';
import { UnsupportedLanguageAnswer, UnsupportedLanguageDialogComponent, UnsupportedLanguagePrompt } from '../unsupported-language-dialog/unsupported-language-dialog.component';

@Component({
  selector: 'app-send-podcast',
  templateUrl: './send-podcast.component.html',
  styleUrls: ['./send-podcast.component.sass'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule]
})

export class SendPodcastComponent {
  submitted = false;
  readonly isSending = signal(false);
  readonly urlShareError = signal(false);
  readonly urlTextError = signal(false);
  readonly unknownError = signal(false);
  readonly submitError = signal(false);
  readonly conflictDismissed = signal(false);
  readonly shareUrl = signal<URL | undefined>(undefined);
  originResponse: SubmitUrlOriginResponse | undefined;

  private auth = inject(AuthServiceWrapper);
  private readonly dialog = inject(MatDialog);
  private readonly seriesResolve = inject(SubmitSeriesResolveService);
  private readonly isAuthenticated = toSignal(this.auth.authService.isAuthenticated$, { initialValue: false });
  private readonly authRoles = toSignal(this.auth.roles, { initialValue: [] as string[] });

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<SendPodcastComponent, SubmitDialogResponse>) {
  }

  /**
   * Spinner / disableClose busy. Toolbar may call this before `prepare` (lookup on
   * general drop/share). `submit()` always calls it again for POST so POST owns busy
   * when there is no prepare — re-entry is intentional (resets error flags).
   */
  public beginBusy() {
    this.isSending.set(true);
    this.urlShareError.set(false);
    this.urlTextError.set(false);
    this.unknownError.set(false);
    this.submitError.set(false);
    this.conflictDismissed.set(false);
  }

  public markSubmitError() {
    this.isSending.set(false);
    this.submitError.set(true);
  }

  close() {
    this.dialogRef.close({ submitted: this.submitted, originResponse: this.originResponse, });
  }

  public async submit(data: Share) {
    const url = parseSubmittablePodcastUrl(data.url.toString());

    if (url) {
      this.beginBusy();
      const body = data.parent
        ? submitParentPostBody(url, data.parent)
        : submitEpisodePostBody(url, { podcastId: data.podcastId, podcastName: data.podcastName });
      let headers: HttpHeaders = new HttpHeaders();
      if (this.isAuthenticated() || localStorage.getItem("hasLoggedIn")) {
        let token: string | undefined;
        try {
          token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
            authorizationParams: {
              audience: `https://api.cultpodcasts.com/`,
              scope: this.authRoles().includes('Curator') ? 'curate' : 'submit'
            }
          }));
        } catch (e) {
          console.error(e);
        }
        if (token) {
          headers = headers.set("Authorization", "Bearer " + token);
        }
      }

      try {
        const resp = await this.postSubmit(body, headers);
        if (resp.status == 200 && resp.body?.languageDecision) {
          const answer = await this.askLanguage(resp.body.languageDecision as UnsupportedLanguagePrompt);
          if (answer !== 'add' && answer !== 'continue') {
            this.isSending.set(false);
            return;
          }
          const created = await this.postSubmit({ ...body, languageDecision: answer }, headers);
          this.finishSubmit(created);
          return;
        }
        this.finishSubmit(resp);
      } catch (error) {
        if (!data.parent && !data.podcastId && error instanceof HttpErrorResponse && error.status === 409) {
          this.isSending.set(false);
          const conflict = await resolveSubmitNameConflict(
            this.seriesResolve,
            this.dialog,
            error,
            data.podcastName
          );
          if (conflict.kind === 'cancelled') {
            this.conflictDismissed.set(true);
            return;
          }
          if (conflict.kind === 'selection' && conflict.selection.podcastId) {
            await this.submit({
              ...data,
              podcastId: conflict.selection.podcastId,
              podcastName: conflict.selection.podcastName
            });
            return;
          }
        }
        this.isSending.set(false);
        this.submitError.set(true);
      }
      return;
    }

    if (data.shareMode == ShareMode.Share) {
      this.urlShareError.set(true);
      this.shareUrl.set(data.url);
    } else if (data.shareMode == ShareMode.Text) {
      this.urlTextError.set(true);
      this.shareUrl.set(data.url);
    } else {
      this.unknownError.set(true);
    }
  }

  private postSubmit(body: object, headers: HttpHeaders) {
    return firstValueFrom<HttpResponse<any>>(this.http.post(
      new URL("/submit", environment.api).toString(),
      body,
      { headers: headers, observe: 'response' }));
  }

  private finishSubmit(resp: HttpResponse<any>) {
    if (resp.status == 200 && !resp.body?.languageDecision && !resp.body?.cancelled) {
      this.submitted = true;
      if (resp.headers.get('X-Origin')) {
        this.originResponse = resp.body;
      }
    } else if (resp.status != 200) {
      this.submitError.set(true);
      this.isSending.set(false);
    }
    this.close();
  }

  private askLanguage(prompt: UnsupportedLanguagePrompt) {
    return firstValueFrom(this.dialog.open<UnsupportedLanguageDialogComponent, UnsupportedLanguagePrompt, UnsupportedLanguageAnswer>(
      UnsupportedLanguageDialogComponent,
      { data: prompt, disableClose: true, autoFocus: true, width: '36rem' }
    ).afterClosed());
  }
}
