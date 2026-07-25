import { Injectable, signal } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { combineLatest, filter, of, ReplaySubject, take } from 'rxjs';

/**
 * Playwright sets `globalThis.__E2E_CURATOR__` via addInitScript so curator
 * routes and getAccessTokenSilently work without live Auth0.
 */
declare global {
    var __E2E_CURATOR__: boolean | undefined;
}

/** Survives reloads so the toolbar can show the avatar while Auth0 restores the session. */
export const AUTH_AVATAR_STORAGE_KEY = 'authAvatarUrl';
export const HAS_LOGGED_IN_STORAGE_KEY = 'hasLoggedIn';

@Injectable({ providedIn: 'root' })
export class AuthServiceWrapper {
    roles: ReplaySubject<string[]> = new ReplaySubject<string[]>(1);
    isSignedIn: ReplaySubject<boolean> = new ReplaySubject<boolean>(1);

    /** Avatar to show in the toolbar — seeded from localStorage, cleared when signed out. */
    private readonly _avatarUrl = signal<string | null>(AuthServiceWrapper.readStoredAvatar());
    readonly avatarUrl = this._avatarUrl.asReadonly();

    constructor(public authService: AuthService) {
        if (typeof globalThis !== 'undefined' && globalThis.__E2E_CURATOR__) {
            const curatorUser = {
                sub: 'e2e|curator',
                picture: 'https://example.com/e2e-avatar.png',
                'https://api.cultpodcasts.com/roles': ['Curator']
            };
            this.authService = {
                user$: of(curatorUser),
                isAuthenticated$: of(true),
                isLoading$: of(false),
                getAccessTokenSilently: () => of('e2e-test-token')
            } as unknown as AuthService;
        }

        if (this.authService.user$) {
            let existingRoles: string[] = [];
            this.authService.user$.subscribe(user => {
                if (user?.picture) {
                    this.persistAvatar(user.picture);
                }
                if (user && user["https://api.cultpodcasts.com/roles"]) {
                    var newRoles = user["https://api.cultpodcasts.com/roles"];
                    if (existingRoles.length != newRoles.length || !existingRoles.every(item => newRoles.includes(item))) {
                        existingRoles = newRoles;
                        this.roles.next(newRoles);
                        if (typeof localStorage !== 'undefined') {
                            localStorage.setItem(HAS_LOGGED_IN_STORAGE_KEY, "true");
                        }
                    }
                }
            });
            this.authService.isAuthenticated$.subscribe(isAuthenticated => {
                this.isSignedIn.next(isAuthenticated);
            });

            // Once Auth0 finishes loading, drop a stale cached avatar if the session is gone.
            if (this.authService.isLoading$) {
                combineLatest([this.authService.isLoading$, this.authService.isAuthenticated$])
                    .pipe(
                        filter(([loading]) => !loading),
                        take(1)
                    )
                    .subscribe(([, isAuthenticated]) => {
                        if (!isAuthenticated) {
                            this.clearCachedAvatar();
                        }
                    });
            }
        }
    }

    /** Call on explicit logout so the toolbar flips immediately before Auth0 redirects. */
    clearCachedAvatar(): void {
        this._avatarUrl.set(null);
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(AUTH_AVATAR_STORAGE_KEY);
        }
    }

    private persistAvatar(picture: string): void {
        this._avatarUrl.set(picture);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(AUTH_AVATAR_STORAGE_KEY, picture);
        }
    }

    private static readStoredAvatar(): string | null {
        if (typeof localStorage === 'undefined') {
            return null;
        }
        const value = localStorage.getItem(AUTH_AVATAR_STORAGE_KEY);
        return value && value.length > 0 ? value : null;
    }
}
