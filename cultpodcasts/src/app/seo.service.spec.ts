import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { PLATFORM_ID } from '@angular/core';
import { SeoService } from './seo.service';
import { FeatureSwitch } from './feature-switch.enum';
import { FeatureSwitchService } from './feature-switch-service';

describe('SeoService share images', () => {
  let meta: Meta;
  let seo: SeoService;
  let episodeOgShareImageEnabled: boolean;

  beforeEach(() => {
    episodeOgShareImageEnabled = false;
    TestBed.configureTestingModule({
      providers: [
        SeoService,
        {
          provide: FeatureSwitchService,
          useValue: {
            IsEnabled: (fs: FeatureSwitch) =>
              fs === FeatureSwitch.episodeOgShareImage ? episodeOgShareImageEnabled : false
          }
        },
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: 'url', useValue: new URL('https://cultpodcasts.com/podcast/Show/ep') }
      ]
    });
    meta = TestBed.inject(Meta);
    seo = TestBed.inject(SeoService);
    seo.AddRequiredMetaTags();
  });

  it('keeps site icon and summary card when page has no episode image', () => {
    seo.AddMetaTags({ title: 'Ep | Show', description: 'Show' });

    expect(meta.getTag('property="og:image"')?.content)
      .toBe('https://cultpodcasts.com/assets/sq-image.png');
    expect(meta.getTag('name="twitter:card"')?.content).toBe('summary');
  });

  it('ignores episode art when FeatureSwitch.episodeOgShareImage is OFF', () => {
    episodeOgShareImageEnabled = false;
    seo.AddMetaTags({
      title: 'Ep | Show',
      description: 'Show',
      image: 'https://i.scdn.co/image/ab6765cover',
      imageAspect: 'square'
    });

    expect(meta.getTag('property="og:image"')?.content)
      .toBe('https://cultpodcasts.com/assets/sq-image.png');
    expect(meta.getTag('name="twitter:card"')?.content).toBe('summary');
  });

  it('uses episode art with summary for square covers when switch is ON', () => {
    episodeOgShareImageEnabled = true;
    seo.AddMetaTags({
      title: 'Ep | Show',
      description: 'Show',
      image: 'https://i.scdn.co/image/ab6765cover',
      imageAspect: 'square'
    });

    expect(meta.getTag('property="og:image"')?.content)
      .toBe('https://i.scdn.co/image/ab6765cover');
    expect(meta.getTag('name="twitter:image"')?.content)
      .toBe('https://i.scdn.co/image/ab6765cover');
    expect(meta.getTag('name="twitter:card"')?.content).toBe('summary');
  });

  it('uses summary_large_image for wide YouTube art when switch is ON', () => {
    episodeOgShareImageEnabled = true;
    seo.AddMetaTags({
      title: 'Ep | Show',
      description: 'Show',
      image: 'https://i.ytimg.com/vi/griffinsong42/hqdefault.jpg',
      imageAspect: 'wide'
    });

    expect(meta.getTag('property="og:image"')?.content)
      .toBe('https://i.ytimg.com/vi/griffinsong42/hqdefault.jpg');
    expect(meta.getTag('name="twitter:card"')?.content).toBe('summary_large_image');
  });
});
