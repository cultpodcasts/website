import buildJson from './build.json';

/** Build-time flags written by `build.sh` into `build.json`. */
export interface BuildConfig {
  flixPromoEnabled: boolean;
}

export const buildConfig: BuildConfig = buildJson;
