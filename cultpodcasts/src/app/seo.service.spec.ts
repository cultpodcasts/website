import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { PLATFORM_ID } from '@angular/core';
import { SeoService } from './seo.service';

describe('SeoService share images', () => {
  let meta: Meta;
  let seo: SeoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SeoService,
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

  it('uses episode art with summary for square covers', () => {
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

  it('uses summary_large_image for wide YouTube art', () => {
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
