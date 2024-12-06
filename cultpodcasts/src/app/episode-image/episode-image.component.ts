import { NgClass } from '@angular/common';
import { Component, Input, input } from '@angular/core';

@Component({
  selector: 'app-episode-image',
  imports: [NgClass],
  templateUrl: './episode-image.component.html',
  styleUrl: './episode-image.component.sass'
})
export class EpisodeImageComponent {
  @Input({ required: true })
  imageUrl: URL | undefined;

  get isCropped(): boolean {
    if (this.imageUrl &&
      this.imageUrl.host.indexOf("i.ytimg.com") == 0 &&
      this.imageUrl.pathname.indexOf("maxresdefault") == -1) {
      return true;
    }
    return false;
  }
}
