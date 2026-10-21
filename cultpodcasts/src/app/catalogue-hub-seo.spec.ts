import { Component, PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { CatalogueHub } from './catalogue-hub';
import { connectCatalogueHubSeo } from './catalogue-hub-seo';
import { EpisodeService } from './episode.service';
import { IPageDetails } from './page-details.interface';
import { SeoService } from './seo.service';

let hubUnderTest: CatalogueHub = 'news';

@Component({ selector: 'app-hub-seo-host', template: '' })
class HubSeoHostComponent {
  readonly hubSeo = connectCatalogueHubSeo(hubUnderTest);
  ngOnInit(): void {
    this.hubSeo.start();
  }
}

describe('connectCatalogueHubSeo', () => {
  let meta: IPageDetails[];
  let pageDetails: ReturnType<typeof vi.fn>;

  function setup(platform: 'server' | 'browser', hub: CatalogueHub, slug: string) {
    hubUnderTest = hub;
    meta = [];
    TestBed.configureTestingModule({
      imports: [HubSeoHostComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: PLATFORM_ID, useValue: platform },
        { provide: ActivatedRoute, useValue: { params: of({ slug }) } },
        { provide: SeoService, useValue: { AddMetaTags: (d: IPageDetails) => meta.push(d) } },
        { provide: EpisodeService, useValue: { getHubPageDetailsViaApi: pageDetails } }
      ]
    });
    const fixture = TestBed.createComponent(HubSeoHostComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  async function settle() {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  }

  beforeEach(() => {
    pageDetails = vi.fn();
  });

  it('server: sets title, description and image from /pagedetails/{hub}/{name}', async () => {
    const details = { title: 'Desk', description: 'Desk has 3 reports found by CultPodcasts.com', image: 'https://api.example/og-image?u=x' };
    pageDetails.mockResolvedValue(details);
    const host = setup('server', 'news', 'Desk');
    await settle();
    expect(pageDetails).toHaveBeenCalledWith('news', 'Desk');
    expect(meta).toEqual([details]);
    expect(host.hubSeo.slug()).toBe('Desk');
  });

  it('server: falls back to the name when page details fail (e.g. 400 for an empty hub)', async () => {
    pageDetails.mockRejectedValue({ status: 400 });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setup('server', 'tv', 'Nightly');
    await settle();
    expect(pageDetails).toHaveBeenCalledWith('tv', 'Nightly');
    expect(meta).toEqual([{ title: 'Nightly' }]);
  });

  it('browser: sets the title only and makes no page-details call', async () => {
    setup('browser', 'news', 'Desk');
    await settle();
    expect(pageDetails).not.toHaveBeenCalled();
    expect(meta).toEqual([{ title: 'Desk' }]);
  });
});
