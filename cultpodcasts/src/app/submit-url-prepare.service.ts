import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AUTH_SCOPE } from './auth.interceptor';
import { environment } from './../environments/environment';
import type { StreamingPrepareResponse } from './streaming-submit-contract';

@Injectable({ providedIn: 'root' })
export class SubmitUrlPrepareService {
  private readonly http = inject(HttpClient);

  async prepare(url: string): Promise<StreamingPrepareResponse> {
    const endpoint = new URL('/submit/prepare', environment.api);
    return firstValueFrom(
      this.http.post<StreamingPrepareResponse>(
        endpoint.toString(),
        { url },
        {
          context: new HttpContext().set(AUTH_SCOPE, 'submit')
        }
      )
    );
  }
}
