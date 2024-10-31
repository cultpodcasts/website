import { Injectable } from "@angular/core";
import { of, Observable, firstValueFrom } from "rxjs";
import { AuthServiceWrapper } from "./AuthServiceWrapper";
import { HttpClient, HttpHeaders, HttpResponse } from "@angular/common/http";
import { environment } from '../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class PushSubscriptionService {
    constructor(
        private http: HttpClient,
        private auth: AuthServiceWrapper) {
    }

    async addPushSubscriber(sub: PushSubscription): Promise<boolean> {
        try {
            let headers: HttpHeaders = new HttpHeaders();
            var token = await await firstValueFrom(this.auth.authService.getAccessTokenSilently({
                authorizationParams: {
                    audience: `https://api.cultpodcasts.com/`,
                    scope: 'admin'
                }
            }));
            if (token) {
                headers = headers.set("Authorization", "Bearer " + token);
            }
            const resp = await firstValueFrom<HttpResponse<any>>(this.http.post(new URL("/pushsubscription", environment.api).toString(), sub, { headers: headers, observe: 'response' }));
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    }
}
