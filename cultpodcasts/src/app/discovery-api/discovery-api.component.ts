import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { Subject, firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';
import { IDiscoveryResults } from '../IDiscoveryResults';
import { IDiscoveryResult } from "../IDiscoveryResult";
import { MatDialog } from '@angular/material/dialog';
import { DiscoverySubmitComponent } from '../discovery-submit/discovery-submit.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfirmComponent } from '../confirm/confirm.component';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { ISubmitDiscoveryState } from '../ISubmitDiscoveryState';
import { DiscoveryItemFilter } from '../discovery-item-filterr';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { HideDirective } from '../hide.directive';
import { MatDividerModule } from '@angular/material/divider';
import { DiscoveryItemComponent } from '../discovery-item/discovery-item.component';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { SiteService } from '../SiteService';

@Component({
  selector: 'app-discovery-api',
  imports: [
    MatProgressBarModule,
    DiscoveryItemComponent,
    MatDividerModule,
    HideDirective,
    MatButtonToggleModule,
    MatButtonModule,
    MatBadgeModule,
    DatePipe,
    DiscoveryItemFilter
  ],
  templateUrl: './discovery-api.component.html',
  styleUrl: './discovery-api.component.sass'
})
export class DiscoveryApiComponent {
  @ViewChild('resultsContainer', { static: false }) resultsContainer: ElementRef | undefined;

  results: IDiscoveryResult[] = [];
  documentIds: string[] = [];
  selectedIds: string[] = [];
  isLoading: boolean = true;
  minDate: Date | undefined;
  saveDisabled: boolean = true;
  closeDisabled: boolean = false;
  displaySave: boolean = false;
  submitted: boolean = false;
  submittedSubject: Subject<boolean> = new Subject<boolean>();
  resultsFilterSubject: Subject<string> = new Subject<string>();
  erroredSubject: Subject<string[]> = new Subject<string[]>();
  resultsFilter: string = "all";
  hasUnfocused: boolean = false;
  isInError: boolean = false;

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router,
    private siteService: SiteService
  ) { }

  ngOnInit() {
    this.siteService.setQuery(null);
    this.siteService.setPodcast(null);
    this.siteService.setSubject(null);

    this.isLoading = true;
    this.isInError = false;
    var token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));
    token.then(_token => {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + _token);
      const endpoint = new URL("/discovery-curation", environment.api).toString();
      this.http.get<IDiscoveryResults>(endpoint, { headers: headers })
        .subscribe({
          next: resp => {
            this.isInError = false;
            this.results = resp.results.map(x => this.enrichFocused(x));
            this.hasUnfocused = this.results.filter(x => !x.isFocused).length > 0;
            this.documentIds = resp.ids;
            const dates = resp.results.map(x => x.released).filter(x => x.getTime).map(x => x.getTime());
            if (dates.length > 0)
              this.minDate = new Date(Math.min(...dates));
            this.isLoading = false;
            this.displaySave = true;
          },
          error: e => {
            this.isLoading = false;
            this.isInError = true;
          }
        })
    }).catch(x => {
      this.isLoading = false;
      this.isInError = true;
    });
  }

  async close() {
    if (this.resultsContainer?.nativeElement.querySelectorAll("mat-card.selected").length == 0) {
      let dialogRef = this.dialog.open(ConfirmComponent, {
        data: { question: 'Are you sure you want to close without any episodes?', title: 'Confirm Close' },
        disableClose: true,
        autoFocus: true
      });
      dialogRef.afterClosed().subscribe(async result => {
        if (result.result === true) {
          await this.save();
        }
      });
    }
  }

  async save() {
    this.saveDisabled = true;
    this.closeDisabled = true;
    this.submittedSubject.next(true);

    const dialog = this.dialog
      .open<DiscoverySubmitComponent, any, ISubmitDiscoveryState>(DiscoverySubmitComponent, { disableClose: true, autoFocus: true });
    dialog
      .afterClosed()
      .subscribe(async result => {
        if (result && !result.endpointError && !result.allErrored) {
          let snackBarMessage = "Discovery Sent!"
          let snackBarDuration = 10000;
          if (result.hasErrors) {
            snackBarMessage = "Discovery Sent! Errors Occured."
            snackBarDuration = 10000;
            this.resultsFilter = "errored";
            this.erroredSubject.next(result.erroredItems);
            this.resultsFilterSubject.next(this.resultsFilter);
          }
          const results = result.episodeIds?.length ?? 0;
          const review: boolean = !result.hasErrors && results > 0;
          let snackBarRef = this.snackBar.open(snackBarMessage, review ? "Review" : "Ok", { duration: snackBarDuration });
          if (review) {
            snackBarRef.onAction().subscribe(() => {
              const episodeIds = JSON.stringify(result.episodeIds);
              this.router.navigate(["/episodes", episodeIds])
            });
          }
          this.displaySave = false;
          this.submitted = true;
          this.submittedSubject.next(this.submitted);
        } else {
          this.submitted = false;
          this.submittedSubject.next(this.submitted);
          this.closeDisabled = this.selectedIds.length > 0;
          this.saveDisabled = this.selectedIds.length === 0;
        }
      });
    await dialog.componentInstance.submit({
      documentIds: this.documentIds!,
      resultIds: this.selectedIds
    });
  }

  handleEvent($event: { id: string; selected: boolean; }) {
    if ($event.selected) {
      this.selectedIds.push($event.id);
    } else {
      this.selectedIds = this.selectedIds.filter(x => x !== $event.id);
    }
    this.closeDisabled = this.selectedIds.length > 0;
    this.saveDisabled = this.selectedIds.length === 0;
  }

  private enrichFocused(result: IDiscoveryResult): IDiscoveryResult {
    result.isFocused = result.matchingPodcasts.length > 0 ||
      result.subjects.length > 0 ||
      (result.youTubeViews != undefined && result.youTubeViews > 100) ||
      (result.youTubeChannelMembers != undefined && result.youTubeChannelMembers > 1000);
    return result;
  }

  resultsFilterChange($event: MatButtonToggleChange) {
    this.resultsFilter = $event.value;
    this.resultsFilterSubject.next(this.resultsFilter);
  }
}
