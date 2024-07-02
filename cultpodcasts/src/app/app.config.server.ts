import { mergeApplicationConfig, ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { appConfig } from './app.config';
import { FakeAuthServiceWrapper } from './FakeAuthServiceWrapper';
import { AuthService } from '@auth0/auth0-angular';
import { provideHttpClient, withFetch } from '@angular/common/http';

const serverConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withFetch()
     ),
    provideServerRendering(),
    {
      provide: AuthService,
      useClass: FakeAuthServiceWrapper,
    },
    FakeAuthServiceWrapper,
    importProvidersFrom(FakeAuthServiceWrapper)
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
