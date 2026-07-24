import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SeoService } from '../seo.service';
import { SubjectApiComponent } from '../subject-api/subject-api.component';
import { SiteLoadingComponent } from '../site-loading/site-loading.component';

@Component({
  selector: 'app-subject',
  templateUrl: './subject.component.html',
  styleUrls: ['./subject.component.sass'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SubjectApiComponent, SiteLoadingComponent]
})

export class SubjectComponent {
  private route = inject(ActivatedRoute);

  constructor(private seoService: SeoService) { }

  ngOnInit() {
    this.route.params.subscribe(params => {
      const subjectName = params["subjectName"];
      this.seoService.AddMetaTags({ title: `'${subjectName}'` });
    })
  }
}
