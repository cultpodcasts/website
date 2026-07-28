import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';
import { environment } from './environments/environment';

declare global {
  // One warn per Node process (prerender boots main.server once per route).
  // eslint-disable-next-line no-var -- ambient process flag
  var __cultpodcastsSsrTlsWarned: boolean | undefined;
}

try {
    if (true === environment?.ssrIgnoresSsl) {
        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
        if (!globalThis.__cultpodcastsSsrTlsWarned) {
            globalThis.__cultpodcastsSsrTlsWarned = true;
            console.warn('main.server.ts: SSR is running with SSL Certificate Checking disabled because environment.ssrIgnoresSsl is true.');
        }
    }
} catch (error) {
    console.error("Unable to ignore tls-reject errors");
}

const bootstrap = (context: BootstrapContext) => bootstrapApplication(AppComponent, config, context);

export default bootstrap;
