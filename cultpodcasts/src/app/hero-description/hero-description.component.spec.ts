import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { HeroDescriptionComponent } from './hero-description.component';
import { HeroDescToggleIcon, HeroDescToggleLabel } from './hero-description';

const here = dirname(fileURLToPath(import.meta.url));
const descSass = readFileSync(join(here, 'hero-description.component.sass'), 'utf8').replaceAll('\r\n', '\n');
const homepageSass = readFileSync(join(here, '../homepage-hero/homepage-hero.component.sass'), 'utf8').replaceAll('\r\n', '\n');

const LONG = Array.from({ length: 30 }, (_, i) => `Synthetic sentence ${i + 1} about an invented episode.`).join(' ');

describe('HeroDescriptionComponent Sass contracts (homepage parity, #703)', () => {
  it('clamps 5 lines wide, 4 at <=1280px and 3 at <=700px, like the homepage hero (HERO-SCR-002)', () => {
    expect(descSass).toMatch(/^:host\n[\s\S]*?--hero-desc-lines:\s*5/m);
    expect(descSass).toMatch(/@media screen and \(max-width: 1280px\)\n    :host\n        --hero-desc-lines:\s*4/);
    expect(descSass).toMatch(/@media screen and \(max-width: 700px\)\n    :host\n        --hero-desc-lines:\s*3/);
    expect(homepageSass).toMatch(/--hero-desc-lines:\s*5/);
    expect(homepageSass).toMatch(/@media screen and \(max-width: 1280px\)\n    \.billboard\n        --hero-desc-lines:\s*4/);
    expect(homepageSass).toMatch(/@media screen and \(max-width: 700px\)\n    \.billboard\n        --hero-desc-lines:\s*3/);
  });

  it('the clamp is on the is-clamped modifier only (Azure text unchanged, #702)', () => {
    const textRule = descSass.slice(descSass.indexOf('\n.hero-desc__text\n'), descSass.indexOf('\n.hero-desc__fade'));
    const base = textRule.slice(0, textRule.indexOf('&.is-clamped'));
    expect(base).not.toMatch(/line-clamp/);
    expect(textRule).toMatch(/&\.is-clamped\n[\s\S]*?-webkit-line-clamp:\s*var\(--hero-desc-lines\)/);
    expect(textRule).toMatch(/&\.is-clamped\n[\s\S]*?overflow-wrap:\s*anywhere/);
    expect(textRule).toMatch(/&\.is-clamped\n[\s\S]*?scrollbar-gutter:\s*stable/);
  });

  it('HERO-DSC-001 / 003: inline chevron at the bottom-right; expanded gets a 40px band and scrolls inside past 60vh', () => {
    expect(descSass).toMatch(/\.hero-desc__wrap\n\s+position:\s*relative/);
    expect(descSass).toMatch(/\.hero-desc__wrap\n[\s\S]*?&\.is-expanded\n\s+padding-bottom:\s*40px/);
    expect(descSass).toMatch(/\.hero-desc__toggle\n\s+position:\s*absolute\n\s+right:\s*0\n\s+bottom:/);
    expect(descSass).toMatch(/&\.is-clamped\.is-expanded\n[\s\S]*?max-height:\s*60vh[\s\S]*?overflow-y:\s*auto/);
  });
});

describe('HeroDescriptionComponent', () => {
  let fixture: ComponentFixture<HeroDescriptionComponent>;

  async function render(text: string, clamped = true, platform = 'browser') {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [HeroDescriptionComponent],
      providers: [provideZonelessChangeDetection(), { provide: PLATFORM_ID, useValue: platform }],
    }).compileComponents();
    fixture = TestBed.createComponent(HeroDescriptionComponent);
    fixture.componentRef.setInput('text', text);
    fixture.componentRef.setInput('clamped', clamped);
    await fixture.whenStable();
  }

  const root = () => fixture.nativeElement as HTMLElement;
  const desc = () => root().querySelector('.hero-desc__text') as HTMLElement;
  const toggle = () => root().querySelector<HTMLButtonElement>('button.hero-desc__toggle');

  /** happy-dom has no layout: fake the clamped box against its content, then re-measure. */
  async function fakeOverflow(overflowing: boolean) {
    Object.defineProperty(desc(), 'clientHeight', { configurable: true, value: 100 });
    Object.defineProperty(desc(), 'scrollHeight', { configurable: true, value: overflowing ? 240 : 100 });
    (fixture.componentInstance as unknown as { measure(): void }).measure();
    await fixture.whenStable();
  }

  describe('clamped (D1)', () => {
    beforeEach(async () => render(LONG));

    it('renders the full text in a clamped paragraph', () => {
      expect(desc().textContent).toBe(LONG);
      expect(desc().classList.contains('is-clamped')).toBe(true);
      expect(root().classList.contains('is-clamped')).toBe(true);
    });

    it('no expander and no fade when the text fits the clamp', async () => {
      await fakeOverflow(false);
      expect(toggle()).toBeNull();
      expect(root().querySelector('.hero-desc__fade')).toBeNull();
    });

    it('HERO-DSC-001: an inline expander over a fade when the text overflows', async () => {
      await fakeOverflow(true);
      const wrap = root().querySelector('.hero-desc__wrap')!;
      const button = toggle()!;
      expect(wrap.contains(button)).toBe(true);
      expect(wrap.querySelector('.hero-desc__fade')?.getAttribute('aria-hidden')).toBe('true');
      expect(button.getAttribute('type')).toBe('button');
      expect(button.getAttribute('aria-label')).toBe(HeroDescToggleLabel.Expand);
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(button.getAttribute('aria-controls')).toBe(desc().id);
      expect(desc().id).toMatch(/^hero-desc-\d+$/);
      expect(button.querySelector('mat-icon')?.textContent?.trim()).toBe(HeroDescToggleIcon.Expand);
      expect(desc().hasAttribute('tabindex')).toBe(false);
    });

    it('expands and collapses: aria, icon, classes, focusable scroller, fade only collapsed', async () => {
      await fakeOverflow(true);
      toggle()!.click();
      await fixture.whenStable();
      expect(toggle()!.getAttribute('aria-label')).toBe(HeroDescToggleLabel.Collapse);
      expect(toggle()!.getAttribute('aria-expanded')).toBe('true');
      expect(toggle()!.querySelector('mat-icon')?.textContent?.trim()).toBe(HeroDescToggleIcon.Collapse);
      expect(desc().classList.contains('is-expanded')).toBe(true);
      expect(root().classList.contains('is-expanded')).toBe(true);
      expect(root().querySelector('.hero-desc__wrap')!.classList.contains('is-expanded')).toBe(true);
      expect(desc().getAttribute('tabindex')).toBe('0');
      expect(root().querySelector('.hero-desc__fade')).toBeNull();

      desc().scrollTop = 120;
      toggle()!.click();
      await fixture.whenStable();
      expect(toggle()!.getAttribute('aria-expanded')).toBe('false');
      expect(desc().classList.contains('is-expanded')).toBe(false);
      expect(desc().scrollTop).toBe(0);
      expect(root().querySelector('.hero-desc__fade')).not.toBeNull();
    });

    it('keeps the toggle while expanded even if the unclamped box no longer overflows', async () => {
      await fakeOverflow(true);
      toggle()!.click();
      await fixture.whenStable();
      await fakeOverflow(false);
      expect(toggle()).not.toBeNull();
    });

    it('collapses when the text changes (another item)', async () => {
      await fakeOverflow(true);
      toggle()!.click();
      await fixture.whenStable();
      fixture.componentRef.setInput('text', `${LONG} More.`);
      await fixture.whenStable();
      expect(desc().classList.contains('is-expanded')).toBe(false);
      expect(fixture.componentInstance.expanded()).toBe(false);
    });

    it('emits expandedChange before the new state renders (host measures the collapsed layout)', async () => {
      await fakeOverflow(true);
      const seen: { value: boolean; expandedClass: boolean }[] = [];
      fixture.componentInstance.expandedChange.subscribe((value) =>
        seen.push({ value, expandedClass: desc().classList.contains('is-expanded') }));
      toggle()!.click();
      await fixture.whenStable();
      toggle()!.click();
      await fixture.whenStable();
      expect(seen).toEqual([
        { value: true, expandedClass: false },
        { value: false, expandedClass: true },
      ]);
    });

    it('HERO-DSC-003: the expanded chevron sits inside its 40px band', () => {
      expect(descSass).toMatch(/\.hero-desc__wrap\.is-expanded \.hero-desc__toggle\n\s+bottom:\s*4px/);
    });

    it('does not bubble the toggle click to the hero', async () => {
      await fakeOverflow(true);
      let bubbled = false;
      root().addEventListener('click', () => (bubbled = true));
      toggle()!.click();
      expect(bubbled).toBe(false);
    });
  });

  it('unclamped (Azure): plain text, never an expander even when it would overflow', async () => {
    await render(LONG, false);
    await fakeOverflow(true);
    expect(desc().classList.contains('is-clamped')).toBe(false);
    expect(root().classList.contains('is-clamped')).toBe(false);
    expect(toggle()).toBeNull();
  });

  it('server render: no expander until the browser measures', async () => {
    await render(LONG, true, 'server');
    await fakeOverflow(true);
    expect(toggle()).toBeNull();
    expect(desc().textContent).toBe(LONG);
  });
});