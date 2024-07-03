import { PlatformLocation, isPlatformServer } from '@angular/common';
import { Inject, Injectable, Optional, PLATFORM_ID } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { IPageDetails } from './page-details';

const title: string = "Cult Podcasts";

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  isServer: boolean;

  constructor(
    private meta: Meta,
    private titie: Title,
    @Inject(PLATFORM_ID) platformId: any,
    @Optional() @Inject('url') private url: URL,
    private location: PlatformLocation

  ) {
    this.isServer = isPlatformServer(platformId);
  }

  AddMetaTags(pageDetails: IPageDetails) {
    const _title = `${pageDetails.title} | ${title}`;
    if (pageDetails.pageTitle) {
      this.titie.setTitle(`${pageDetails.pageTitle} | ${title}`);
    } else {
      this.titie.setTitle(_title);
    }
    if (this.isServer) {
      if (pageDetails.description) {
        this.meta.updateTag({ name: "description", content: pageDetails.description });
        this.meta.updateTag({ property: "og:description", content: pageDetails.description });
      }
      this.meta.updateTag({ property: "og:title", content: _title });
      console.log(`Added Metatags title: '${_title}', description: '${pageDetails.description}'.`);
    }
  }

  AddRequiredMetaTags() {
    if (this.isServer) {
      const twitterHandle: string = "@cultpodcasts";
      const twitterCardType: string = "summary";
      const twitterType: string = "website";
      const description: string = "Find your Cult Podcasts!";

      this.meta.addTag({ property: "twitter:site", content: twitterHandle });
      this.meta.addTag({ property: "twitter:creator", content: twitterHandle });
      this.meta.addTag({ name: "twitter:card", content: twitterCardType });
      this.meta.addTag({ name: "twitter:type", content: twitterType });
      this.meta.addTag({ name: "description", content: description });
      this.meta.addTag({ property: "og:title", content: title });
      this.meta.addTag({ property: "og:description", content: description });
      if (this.url) {
        const domain: string = this.url.hostname;
        const url: string = this.url.toString();
        this.meta.addTag({ property: "twitter:domain", content: domain });
        this.meta.addTag({ property: "og:url", content: url });
        this.meta.addTag({ property: "og:image", content: new URL("/assets/sq-image.png", this.url).toString() })
      };
    }
    console.log(`Added Required Metatags.`);
  }
}
