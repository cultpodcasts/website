import { isPlatformServer, formatDate } from '@angular/common';
import { Inject, Injectable, Optional, PLATFORM_ID } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { IPageDetails } from './page-details.interface';
import { FeatureSwitch } from './feature-switch.enum';
import { FeatureSwitchService } from './feature-switch-service';

const siteName: string = "Cult Podcasts";
const defaultShareImagePath: string = "/assets/sq-image.png";

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  isServer: boolean;

  constructor(
    private meta: Meta,
    private title: Title,
    private featureSwitchService: FeatureSwitchService,
    @Inject(PLATFORM_ID) platformId: any,
    @Optional() @Inject('url') private url: URL
  ) {
    this.isServer = isPlatformServer(platformId);
  }

  AddMetaTags(pageDetails: IPageDetails) {
    let title: string = siteName;
    if (pageDetails.title) {
      const pageDetailsTItle = pageDetails.title;
      title = `${pageDetailsTItle} | ${siteName}`;
    }
    const htmlTItle = title
      .replaceAll("&amp;", "&")
      .replaceAll("&#39;", "'")
      .replaceAll("&quot;", '"')
      .replaceAll("&apos;", "'");
    this.title.setTitle(htmlTItle);

    if (this.isServer) {
      if (pageDetails.description) {
        let description = pageDetails.description;
        if (pageDetails.releaseDate) {
          try {
            description = description + ", " + formatDate(pageDetails.releaseDate, 'mediumDate', 'en-US');
          } catch (e) {
            console.error(e, "Failure to parse date", pageDetails.releaseDate);
          }
        }
        if (pageDetails.duration) {
          let duration: string = pageDetails.duration.split(".")[0];
          if (duration.startsWith("0")) {
            duration = duration.substring(1);
          }
          description = description + " [" + duration + "]";
        }
        this.meta.updateTag({ name: "description", content: description });
        this.meta.updateTag({ property: "og:description", content: description });
      }
      this.meta.updateTag({ property: "og:title", content: htmlTItle });
      this.applyShareImage(pageDetails);
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
      this.meta.addTag({ property: "og:title", content: siteName });
      this.meta.addTag({ property: "og:description", content: description });
      if (this.url) {
        const domain: string = this.url.hostname;
        const url: string = this.url.toString();
        const shareImage = new URL(defaultShareImagePath, this.url).toString();
        this.meta.addTag({ property: "twitter:domain", content: domain });
        this.meta.addTag({ property: "og:url", content: url });
        this.meta.addTag({ property: "og:image", content: shareImage });
      };
    }
  }

  private applyShareImage(pageDetails: IPageDetails): void {
    const useEpisodeImage =
      this.featureSwitchService.IsEnabled(FeatureSwitch.episodeOgShareImage) &&
      !!pageDetails.image;
    const image = useEpisodeImage
      ? pageDetails.image
      : (this.url ? new URL(defaultShareImagePath, this.url).toString() : undefined);
    if (!image) {
      return;
    }
    this.meta.updateTag({ property: "og:image", content: image });
    this.meta.updateTag({ name: "twitter:image", content: image });
    // Episode art (wide or square) → large card; site-icon fallback stays summary.
    const card = useEpisodeImage ? "summary_large_image" : "summary";
    this.meta.updateTag({ name: "twitter:card", content: card });
  }
}
