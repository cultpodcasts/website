import { Component, inject } from '@angular/core';
import { ActivatedRoute, } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { waitFor } from '../core.module';
import { PodcastApiComponent } from '../podcast-api/podcast-api.component';
import { PodcastTagsService } from '../podcast-tags.service';

@Component({
  selector: 'app-podcast',
  templateUrl: './podcast.component.html',
  styleUrls: ['./podcast.component.sass'],
  standalone: true,
  imports: [
    PodcastApiComponent
  ]
})

export class PodcastComponent {
  podcastName: string = "";

  constructor(
    private podcastTagsService: PodcastTagsService
  ) { }

  async ngOnInit(): Promise<any> {
    waitFor(this.initialiseServer());
  }
  private route = inject(ActivatedRoute);

  async initialiseServer(): Promise<any> {
    const params = await firstValueFrom(this.route.params);
    this.podcastName = params["podcastName"];
    await this.podcastTagsService.populateTags(params["query"], this.podcastName);
  }
}
