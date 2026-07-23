import { Injectable } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { of, ReplaySubject } from 'rxjs';

/**
 * Playwright sets `globalThis.__E2E_CURATOR__` via addInitScript so curator
 * routes and getAccessTokenSilently work without live Auth0.
 */
declare global {
    var __E2E_CURATOR__: boolean | undefined;
}

@Injectable({ providedIn: 'root' })
export class AuthServiceWrapper {
    roles: ReplaySubject<string[]> = new ReplaySubject<string[]>(1);
    isSignedIn: ReplaySubject<boolean> = new ReplaySubject<boolean>(1);

    constructor(public authService: AuthService) {
        if (typeof globalThis !== 'undefined' && globalThis.__E2E_CURATOR__) {
            const curatorUser = {
                sub: 'e2e|curator',
                'https://api.cultpodcasts.com/roles': ['Curator']
            };
            this.authService = {
                user$: of(curatorUser),
                isAuthenticated$: of(true),
                getAccessTokenSilently: () => of('e2e-test-token')
            } as unknown as AuthService;
        }

        if (this.authService.user$) {
            let existingRoles: string[] = [];
            this.authService.user$.subscribe(user => {
                if (user && user["https://api.cultpodcasts.com/roles"]) {
                    var newRoles = user["https://api.cultpodcasts.com/roles"];
                    if (existingRoles.length != newRoles.length || !existingRoles.every(item => newRoles.includes(item))) {
                        existingRoles = newRoles;
                        this.roles.next(newRoles);
                        if (typeof localStorage !== 'undefined') {
                            localStorage.setItem("hasLoggedIn", "true");
                        }
                    }
                }
            });
            this.authService.isAuthenticated$.subscribe(isAuthenticated => {
                this.isSignedIn.next(isAuthenticated);
            });
        }
    }
}