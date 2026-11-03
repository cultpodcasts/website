/**
 * Shared Vitest / Angular unit-test harness.
 *
 * Production registers SVG icons in `AppComponent`. Specs that render `mat-icon
 * [svgIcon]` without that registration spam `Error retrieving icon :name`
 * (empty font-set namespace). Episode-player iframes with real YouTube embed
 * URLs also make happy-dom fetch+abort (`DOMException [AbortError]` / NetworkError)
 * when the fixture tears down.
 *
 * Wired from `vitest-base.config.cjs` so every suite stays coherent with the live
 * app without each spec remembering the hooks.
 */
import { TestBed, type TestModuleMetadata } from '@angular/core/testing';
import { provideAppSvgIcons } from '../app/register-svg-icons';

const configureTestingModule = TestBed.configureTestingModule.bind(TestBed);
TestBed.configureTestingModule = (moduleDef: TestModuleMetadata) =>
  configureTestingModule({
    ...moduleDef,
    providers: [...(moduleDef.providers ?? []), provideAppSvgIcons()],
  });

const EMBED_SRC_ATTR = 'data-unit-embed-src';
const YOUTUBE_EMBED = /^(?:https?:)?\/\/(?:www\.)?youtube\.com\/embed\//i;

const iframeProto = HTMLIFrameElement.prototype;
const setAttribute = iframeProto.setAttribute;
iframeProto.setAttribute = function (this: HTMLIFrameElement, name: string, value: string) {
  if (name === 'src' && YOUTUBE_EMBED.test(value)) {
    // Keep the real URL for getAttribute('src') assertions; load about:blank so
    // happy-dom does not navigate a child frame (AbortError on teardown).
    setAttribute.call(this, EMBED_SRC_ATTR, value);
    return setAttribute.call(this, name, 'about:blank');
  }
  return setAttribute.call(this, name, value);
};

const getAttribute = iframeProto.getAttribute;
iframeProto.getAttribute = function (this: HTMLIFrameElement, name: string) {
  if (name === 'src') {
    return getAttribute.call(this, EMBED_SRC_ATTR) ?? getAttribute.call(this, name);
  }
  return getAttribute.call(this, name);
};

Object.defineProperty(iframeProto, 'src', {
  configurable: true,
  enumerable: true,
  get(this: HTMLIFrameElement) {
    return this.getAttribute('src') ?? '';
  },
  set(this: HTMLIFrameElement, value: string) {
    this.setAttribute('src', value ?? '');
  },
});
