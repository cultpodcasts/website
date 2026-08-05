import { AppComponent } from './app/app.component';
import { bootstrapApplication } from '@angular/platform-browser';
import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill';
import { appConfig } from './app/app.config';

// Windows Chromium renders flag emoji as ISO letters (🇪🇸 → "ES"); Firefox shows
// the flag. Load Twemoji flags only when native support is missing.
polyfillCountryFlagEmojis(
  'Twemoji Country Flags',
  '/assets/TwemojiCountryFlags.woff2'
);

bootstrapApplication(AppComponent, appConfig)
    .catch(err => console.error(err));
