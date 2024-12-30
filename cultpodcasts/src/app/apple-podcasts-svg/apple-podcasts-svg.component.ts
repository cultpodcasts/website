import { Component } from '@angular/core';

@Component({
  selector: 'app-apple-podcasts-svg',
  imports: [],
  templateUrl: './apple-podcasts-svg.component.html',
  styleUrl: './apple-podcasts-svg.component.sass'
})
export class ApplePodcastsSvgComponent {
  fillId: string;
  fillIdRef: string;

  constructor() {
    this.fillId = this.randomString(40);
    this.fillIdRef= "url(#" + this.fillId + ")";
  }

  randomString(length: number): string {

    var randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var result = '';
    for (var i = 0; i < length; i++) {
      result += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
    }
    return result;
  }
}
