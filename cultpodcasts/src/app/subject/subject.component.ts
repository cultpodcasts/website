import { Component, Inject, PLATFORM_ID, inject } from '@angular/core';
import { ISearchResult } from '../ISearchResult';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { SiteService } from '../SiteService';
import { ISearchState } from '../ISearchState';
import { ODataService } from '../OdataService'
import { environment } from './../../environments/environment';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { NgIf, NgClass, NgFor, DatePipe, isPlatformBrowser, formatDate } from '@angular/common';
import { SeoService } from '../seo.service';
import { GuidService } from '../guid.service';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EditSubjectDialogComponent } from '../edit-subject-dialog/edit-subject-dialog.component';
import { SubjectApiComponent } from '../subject-api/subject-api.component';



@Component({
  selector: 'app-subject',
  templateUrl: './subject.component.html',
  styleUrls: ['./subject.component.sass'],
  standalone: true,
  imports: [SubjectApiComponent]
})

export class SubjectComponent {
  private route = inject(ActivatedRoute);

  constructor(private seoService: SeoService) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      const subjectName = params["subjectName"];
      this.seoService.AddMetaTags({ title: `'${subjectName}'` });
    })
  }
}
