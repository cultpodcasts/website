import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AUTH_SCOPE } from './auth.interceptor';
import { environment } from './../environments/environment';
import { SubmitUrlLookupResponse } from './submit-url-lookup.interface';

@Injectable({ providedIn: 'root' })
export class SubmitUrlLookupService {
  private readonly http = inject(HttpClient);

  async lookup(url: string): Promise<SubmitUrlLookupResponse> {
    const endpoint = new URL('/submit/lookup', environment.api);
    endpoint.searchParams.set('url', url);
    return firstValueFrom(
      this.http.get<SubmitUrlLookupResponse>(endpoint.toString(), {
        context: new HttpContext().set(AUTH_SCOPE, 'curate')
      })
    );
  }
}
