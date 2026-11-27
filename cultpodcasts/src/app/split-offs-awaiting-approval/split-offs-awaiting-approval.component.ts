import { DatePipe, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EMPTY, Observable, Subject, catchError, defaultIfEmpty, defer, map, switchMap, take, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiEpisode } from '../api-episode.interface';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { EditEpisodeDialogComponent } from '../edit-episode-dialog/edit-episode-dialog.component';
import { EditEpisodeDialogResponse } from '../edit-episode-dialog-response.interface';
import { episodeEditResultMessage } from '../social-retract-result';
import { SiteService } from '../site.service';

/**
 * Curator list of split-offs whose approval status is awaiting approval (RPP #1491).
 * Approve and reject live on the episode editor, the same place a snackbar review opens.
 */
@Component({
  selector: 'app-split-offs-awaiting-approval',
  imports: [MatProgressBarModule, MatButtonModule, DatePipe],
  templateUrl: './split-offs-awaiting-approval.component.html',
  styleUrl: './split-offs-awaiting-approval.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { ngSkipHydration: 'true' },
})
export class SplitOffsAwaitingApprovalComponent {
  protected readonly episodes = signal<ApiEpisode[] | undefined>(undefined);
  protected readonly error = signal(false);
  protected readonly isLoading = signal(true);

  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly auth = inject(AuthServiceWrapper);
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly siteService = inject(SiteService);
  private readonly loadRequests = new Subject<void>();

  constructor() {
    this.siteService.setQuery(null);
    this.siteService.setPodcast(null);
    this.siteService.setSubject(null);

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // A new request cancels the one in flight, so a slow earlier response never overwrites a later one.
    this.loadRequests.pipe(
      switchMap(() => this.fetchAwaitingApproval()),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
    this.load();
  }

  protected review(episode: ApiEpisode): void {
    const dialogRef = this.dialog.open<EditEpisodeDialogComponent, unknown, EditEpisodeDialogResponse>(
      EditEpisodeDialogComponent,
      {
        data: { podcastIdentifier: episode.podcastId, episodeId: episode.id },
        disableClose: true,
        autoFocus: true,
        width: '90%'
      });
    dialogRef.afterClosed().subscribe(result => {
      const message = episodeEditResultMessage(result);
      if (message) {
        this.snackBar.open(message, 'Ok', { duration: result?.updated ? 10000 : 3000 });
      }
      if (result?.updated) {
        this.load();
      }
    });
  }

  protected reset(): void {
    this.load();
  }

  private load(): void {
    this.loadRequests.next();
  }

  /** Gets a fresh access token for every load, then the list. Failures are shown, never thrown. */
  private fetchAwaitingApproval(): Observable<ApiEpisode[]> {
    this.isLoading.set(true);
    this.error.set(false);
    const url = new URL('/episodes/awaiting-approval', environment.api).toString();
    // defer: a synchronous throw from the token call is caught below instead of ending the load stream.
    return defer(() => this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: 'https://api.cultpodcasts.com/',
        scope: 'curate'
      }
    })).pipe(
      take(1),
      defaultIfEmpty(''),
      switchMap(token => {
        const headers = new HttpHeaders().set('Authorization', 'Bearer ' + (token ?? ''));
        return this.http.get<ApiEpisode[]>(url, { headers, observe: 'response' });
      }),
      map(resp => resp.body ?? []),
      tap(list => {
        this.isLoading.set(false);
        this.error.set(false);
        this.episodes.set(list);
      }),
      catchError(err => {
        this.isLoading.set(false);
        this.error.set(true);
        console.error(err);
        return EMPTY;
      })
    );
  }
}
