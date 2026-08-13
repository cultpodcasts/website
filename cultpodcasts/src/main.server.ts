import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';

// Local HTTPS: cultpodcasts/.cert/dev-cert.pem + dev-key.pem via wrangler/ng serve.
// Node prerender trusts that CA through NODE_EXTRA_CA_CERTS (tools/start-local.mjs).

const bootstrap = (context: BootstrapContext) => bootstrapApplication(AppComponent, config, context);

export default bootstrap;
