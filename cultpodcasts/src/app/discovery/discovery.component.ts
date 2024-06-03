import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { firstValueFrom, map } from 'rxjs';
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
  ids: string[] | undefined;
  isLoading: boolean = true;
  minDate: Date | undefined;
  saveDisabled: boolean = true;
  closeDisabled: boolean = false;
  displaySave: boolean = false;
  submitted: boolean = false;

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
          this.results = resp.results;
          this.ids = resp.ids;
          const dates = resp.results.map(x => x.released).filter(x => x.getTime).map(x => x.getTime());
          if (dates.length > 0)
            this.minDate = new Date(Math.min(...dates));
          this.isLoading = false;
          this.displaySave = true;
        })
    });
  }

  handleResult($event: Event, result: IDiscoveryResult) {
    if (this.submitted)
      return;
    const selectedClass: string = "selected";
    let element: Element = $event.target as Element;
    var isButton = false;
    isButton = element.getAttribute("mat-icon-button") != null;
    while (!isButton && element.nodeName.toLowerCase() != "mat-card") {
      console.log(element.nodeName)
      element = element.parentElement!;
      isButton = isButton || element.getAttribute("mat-icon-button") != null;
    }
    if (!isButton) {
      if (element.className.split(" ").includes(selectedClass)) {
        element.className = element.className.split(" ").filter(x => x != selectedClass).join(" ");
      } else {
        element.className = element.className.split(" ").concat(selectedClass).join(" ");
      }
    }
    const itemsSelected = this.resultsContainer!.nativeElement.querySelectorAll("mat-card.selected").length;
    this.closeDisabled = itemsSelected > 0;
    this.saveDisabled = itemsSelected === 0;
  }

  allowLink($event: Event) {
    $event.stopPropagation();
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
    const selected = this.resultsContainer?.nativeElement.querySelectorAll("mat-card.selected");
    const selectedArray = [...selected];
    const ids = selectedArray.map((x: any) => x.dataset.id);

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
        } else {
          this.closeDisabled = selectedArray.length > 0;
          this.saveDisabled = selectedArray.length === 0;
        }
      });
    await dialog.componentInstance.submit({
      documentIds: this.ids!,
      resultIds: ids
    });
  }
}
