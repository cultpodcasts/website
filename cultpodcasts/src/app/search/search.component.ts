import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SeoService } from '../seo.service';
import { SearchApiComponent } from '../search-api/search-api.component';

const queryParam: string = "query";

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.sass'],
  standalone: true,
  imports: [SearchApiComponent]
})
export class SearchComponent {
  private route = inject(ActivatedRoute);

  constructor(private seoService: SeoService) { }

  ngOnInit() {
    this.route.params.subscribe(params => {
      let presentableQuery: string = params[queryParam];
      if ((presentableQuery.startsWith("'") && presentableQuery.endsWith("'")) ||
        (presentableQuery.startsWith("\"") && presentableQuery.endsWith("\""))) {
        presentableQuery = presentableQuery.substring(1, presentableQuery.length - 1);
      }
      this.seoService.AddMetaTags({ title: `Search '${presentableQuery}'` });
    });
  }
}
