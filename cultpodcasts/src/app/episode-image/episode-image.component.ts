import { Component, Input, input } from '@angular/core';

@Component({
  selector: 'app-episode-image',
  imports: [],
  templateUrl: './episode-image.component.html',
  styleUrl: './episode-image.component.sass'
})
export class EpisodeImageComponent {
  @Input()
  imageUrl: URL | undefined | string;
}
