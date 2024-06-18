import { mergeApplicationConfig, ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { appConfig } from './app.config';
import { FakeAuthServiceWrapper } from './FakeAuthServiceWrapper';
import { AuthService } from '@auth0/auth0-angular';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    {
      provide: AuthService,
      useClass: FakeAuthServiceWrapper,
    },
    FakeAuthServiceWrapper,
    importProvidersFrom(FakeAuthServiceWrapper),
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
