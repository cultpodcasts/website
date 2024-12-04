import { NgClass } from '@angular/common';
import { Component, Input, input } from '@angular/core';

@Component({
  selector: 'app-episode-image',
  imports: [NgClass],
  templateUrl: './episode-image.component.html',
  styleUrl: './episode-image.component.sass'
})
export class EpisodeImageComponent {
  @Input()
  imageUrl: URL | undefined | string;

  get isCropped(): boolean {
    if (this.imageUrl) {
      let url = this.imageUrl.toString();
      if (url.indexOf("https://i.ytimg.com") == 0 && url.indexOf("maxresdefault") == -1) {
        return true;
      }
    }
    return false;
  }
}
