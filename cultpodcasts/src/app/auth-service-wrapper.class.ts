import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
    private readonly platformId = inject(PLATFORM_ID);

    roles: ReplaySubject<string[]> = new ReplaySubject<string[]>(1);
    isSignedIn: ReplaySubject<boolean> = new ReplaySubject<boolean>(1);

    /** Avatar to show in the toolbar — seeded from localStorage, cleared when signed out. */
    private readonly _avatarUrl = signal<string | null>(null);
    readonly avatarUrl = this._avatarUrl.asReadonly();

    constructor(public authService: AuthService) {
        // Re-seed on the browser only — SSR/prerender has no localStorage, and a null
        // server value must not stick around after client bootstrap.
        if (isPlatformBrowser(this.platformId)) {
            const stored = AuthServiceWrapper.readStoredAvatar();
            if (stored) {
                this._avatarUrl.set(stored);
            }
        }

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

            // Clear only after Auth0 has finished loading *and* confirmed signed-out.
            // Do not clear while loading — isAuthenticated$ is often false during restore.
            if (this.authService.isLoading$) {
                combineLatest([
                    this.authService.isLoading$,
                    this.authService.isAuthenticated$,
                    this.authService.user$,
                ])
                    .pipe(
                        filter(([loading]) => !loading),
                        take(1)
                    )
                    .subscribe(([, isAuthenticated, user]) => {
                        if (isAuthenticated && user?.picture) {
                            this.persistAvatar(user.picture);
                            return;
                        }
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
