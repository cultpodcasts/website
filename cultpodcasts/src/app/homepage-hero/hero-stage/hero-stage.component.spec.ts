import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileString } from 'sass';
import { HeroStageComponent } from './hero-stage.component';

const stageDir = dirname(fileURLToPath(import.meta.url));
const stageSass = readFileSync(join(stageDir, 'hero-stage.component.sass'), 'utf8').replaceAll('\r\n', '\n');

describe('HeroStageComponent', () => {
  let fixture: ComponentFixture<HeroStageComponent>;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroStageComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    fixture = TestBed.createComponent(HeroStageComponent);
    host = fixture.nativeElement as HTMLElement;
  });

  it('is a blank, inactive .billboard__stage with no image', async () => {
    await fixture.whenStable();
    expect(host.classList).toContain('billboard__stage');
    expect(host.classList).not.toContain('is-active');
    expect(host.classList).not.toContain('is-kenburns');
    expect(host.classList).not.toContain('has-edge-extend');
    expect(host.style.getPropertyValue('--hero-art-aspect')).toBe('');
    const painted = [...host.querySelectorAll<HTMLElement>('.billboard__stage-focus, .billboard__stage-edge-sample')];
    expect(painted.length).toBe(3);
    for (const el of painted) {
      expect(el.style.backgroundImage).toBe('');
    }
  });

  it('paints the art on the focus layer and both edge samples', async () => {
    fixture.componentRef.setInput('image', 'https://img.example/synthetic-a.jpg');
    await fixture.whenStable();
    const painted = [...host.querySelectorAll<HTMLElement>('.billboard__stage-focus, .billboard__stage-edge-sample')];
    expect(painted.length).toBe(3);
    for (const el of painted) {
      expect(el.style.backgroundImage).toContain('https://img.example/synthetic-a.jpg');
    }
    expect(host.querySelector('.billboard__stage-edge--left .billboard__stage-edge-sample')).toBeTruthy();
    expect(host.querySelector('.billboard__stage-edge--right .billboard__stage-edge-sample')).toBeTruthy();
    expect(host.querySelector('.billboard__stage-motion > .billboard__stage-focus-slot > .billboard__stage-focus')).toBeTruthy();
  });

  it('reflects active, Ken Burns and a known aspect as host state', async () => {
    fixture.componentRef.setInput('active', true);
    fixture.componentRef.setInput('kenBurns', true);
    fixture.componentRef.setInput('aspect', 1.5);
    await fixture.whenStable();
    expect(host.classList).toContain('is-active');
    expect(host.classList).toContain('is-kenburns');
    expect(host.classList).toContain('has-edge-extend');
    expect(host.style.getPropertyValue('--hero-art-aspect')).toBe('1.5');

    fixture.componentRef.setInput('aspect', undefined);
    fixture.componentRef.setInput('kenBurns', false);
    await fixture.whenStable();
    expect(host.classList).not.toContain('has-edge-extend');
    expect(host.classList).not.toContain('is-kenburns');
    expect(host.style.getPropertyValue('--hero-art-aspect')).toBe('');
  });

  it('compiled stage CSS stays under the anyComponentStyle warning budget (12 kB)', () => {
    const css = compileString(stageSass, { syntax: 'indented', style: 'compressed' }).css;
    expect(css.length).toBeLessThan(12_000);
  });

  it('keeps the stage layout contracts (contain framing, wide right pin, framed stacked gutters)', () => {
    // Narrow: Ken Burns would crop the contain slot.
    expect(stageSass).toMatch(/:host\(\.has-edge-extend\.is-kenburns\) \.billboard__stage-motion\n\s+animation: none/);
    // Wide: art pinned right, Ken Burns back on.
    expect(stageSass).toMatch(/@media screen and \(min-width: 1280px\)[\s\S]*?\.billboard__stage-focus-slot[\s\S]*?right: 0/);
    expect(stageSass).toMatch(/@media screen and \(min-width: 1280px\)[\s\S]*?:host\(\.has-edge-extend\.is-kenburns\) \.billboard__stage-motion\n\s+animation: nflx-ken-burns/);
    // Stacked framed art: plain gutters, no blurred edge fill.
    expect(stageSass).toMatch(/@media screen and \(max-width: 1280px\)\n\s+:host-context\(\.billboard\.has-art-aspect\)[\s\S]*?\.billboard__stage-edge\n\s+display: none/);
    // Dialog scroll-lock freezes leftover motion.
    expect(stageSass).toMatch(/:host-context\(\.cdk-global-scrollblock\)[\s\S]*?animation-play-state: paused/);
  });
});
