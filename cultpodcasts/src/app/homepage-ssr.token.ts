import { InjectionToken, makeStateKey } from '@angular/core';
import { PreProcessedHomepage } from './preprocessed-homepage.interface';

/** Sync SSR seed from Pages worker R2 read (null when missing). */
export const HOMEPAGE_SSR_DATA = new InjectionToken<PreProcessedHomepage | null>('HOMEPAGE_SSR_DATA');

export const HOMEPAGE_SSR_STATE_KEY = makeStateKey<PreProcessedHomepage>('homepage-ssr');
