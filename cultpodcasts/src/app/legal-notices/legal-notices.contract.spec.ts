import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Legal Notices', () => {
  const legalHtml = readFileSync(join(__dirname, 'legal-notices.component.html'), 'utf8');
  const privacyHtml = readFileSync(
    join(__dirname, '../privacy-policy/privacy-policy.component.html'),
    'utf8'
  );

  it('credits TMDB with the official logo, required notice and a link', () => {
    expect(legalHtml).toMatch(/https:\/\/www\.themoviedb\.org\//);
    expect(legalHtml).toMatch(/\/assets\/attribution\/tmdb-logo\.svg/);
    expect(legalHtml).toContain(
      'This product uses the TMDB API but is not endorsed or certified by TMDB.'
    );
  });

  it('credits TheTVDB with a listed brand logo and a link', () => {
    expect(legalHtml).toMatch(/https:\/\/www\.thetvdb\.com\//);
    expect(legalHtml).toMatch(/\/assets\/attribution\/tvdb-logo2\.png/);
    expect(legalHtml).toMatch(/Metadata provided by/);
  });

  it('credits IMDb with a link', () => {
    expect(legalHtml).toMatch(/https:\/\/www\.imdb\.com\//);
  });

  it('is structured as separate notices so further sources can be added', () => {
    expect(legalHtml).toMatch(/class="legal-notice"/);
    expect(legalHtml.match(/class="legal-notice"/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('is linked from the bottom of the privacy policy page', () => {
    expect(privacyHtml).toMatch(/id="legal-notices"/);
    expect(privacyHtml).toMatch(/\[routerLink\]="\['\/content\/legal-notices'\]"/);
    expect(privacyHtml).toMatch(/>Legal Notices</);
  });
});
