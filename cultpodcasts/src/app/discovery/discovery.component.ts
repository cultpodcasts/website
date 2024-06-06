import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { Subject, firstValueFrom, map } from 'rxjs';
import { environment } from './../../environments/environment';
import { IDiscoveryResult, IDiscoveryResults } from '../IDiscoveryResults';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { DiscoverySubmitComponent } from '../discovery-submit/discovery-submit.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfirmComponent } from '../confirm/confirm.component';

@Component({
  selector: 'app-discovery',
  templateUrl: './discovery.component.html',
  styleUrls: ['./discovery.component.sass']
})
export class DiscoveryComponent {
  @ViewChild('resultsContainer', { static: false }) resultsContainer: ElementRef | undefined;

  results: IDiscoveryResult[] | undefined;
  documentIds: string[] = [];
  selectedIds: string[] = [];
  isLoading: boolean = true;
  minDate: Date | undefined;
  saveDisabled: boolean = true;
  closeDisabled: boolean = false;
  displaySave: boolean = false;
  submitted: boolean = false;
  submittedSubject: Subject<boolean> = new Subject<boolean>();

  constructor(private auth: AuthService, private http: HttpClient, private dialog: MatDialog, private snackBar: MatSnackBar,) { }

  ngOnInit() {
    var token = firstValueFrom(this.auth.getAccessTokenSilently({
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
        .subscribe(resp => {
          this.results = resp.results.map(x => this.enrichFocused(x));
          this.documentIds = resp.ids;
          const dates = resp.results.map(x => x.released).filter(x => x.getTime).map(x => x.getTime());
          if (dates.length > 0)
            this.minDate = new Date(Math.min(...dates));
          this.isLoading = false;
          this.displaySave = true;
        })
    });
  }

  async close() {
    if (this.resultsContainer?.nativeElement.querySelectorAll("mat-card.selected").length == 0) {
      let dialogRef = this.dialog.open(ConfirmComponent, {
        data: { question: 'Are you sure you want to close without any episodes?', title: 'Confirm Close' },
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


    const dialogConfig = new MatDialogConfig();

    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;

    const dialog = this.dialog
      .open(DiscoverySubmitComponent, dialogConfig);
    dialog
      .afterClosed()
      .subscribe(async result => {
        if (result && result.submitted) {
          let snackBarRef = this.snackBar.open('Discovery Sent!', "Ok", { duration: 3000 });
          this.displaySave = false;
          this.submitted = true;
          this.submittedSubject.next(this.submitted);
        } else {
          this.submitted= false;
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
    result.isFocused = result.matchingPodcastIds.length > 0 ||
      result.subjects.length > 0 ||
      (result.youTubeViews != undefined && result.youTubeViews > 100) ||
      (result.youTubeChannelMembers != undefined && result.youTubeChannelMembers > 1000);
    return result;
  }

}
