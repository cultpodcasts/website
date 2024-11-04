import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';
import { environment } from './environments/environment';

try {
    if (true === environment?.ssrIgnoresSsl) {
        console.warn('main.server.ts: SSR is running with SSL Certificate Checking disabled because environment.ssrIgnoresSsl is true.');
        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
    }
} catch (error) {
    console.error("Unable to ignore tls-reject errors");
}

const bootstrap = () => bootstrapApplication(AppComponent, config);

export default bootstrap;
