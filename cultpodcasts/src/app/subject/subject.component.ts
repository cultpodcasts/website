import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SeoService } from '../seo.service';
import { SubjectApiComponent } from '../subject-api/subject-api.component';

@Component({
  selector: 'app-subject',
  templateUrl: './subject.component.html',
  styleUrls: ['./subject.component.sass'],
  imports: [SubjectApiComponent]
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
