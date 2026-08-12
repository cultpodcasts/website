import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { AuthService } from '@auth0/auth0-angular';
import {
  AUTH_AVATAR_STORAGE_KEY,
  AuthServiceWrapper,
  HAS_LOGGED_IN_STORAGE_KEY,
} from './auth-service-wrapper.class';

describe('AuthServiceWrapper avatar cache', () => {
  let isLoading$: BehaviorSubject<boolean>;
  let isAuthenticated$: BehaviorSubject<boolean>;
  let user$: BehaviorSubject<Record<string, unknown> | null>;
  let error$: Subject<Error>;
  let loginWithRedirect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.removeItem(AUTH_AVATAR_STORAGE_KEY);
    localStorage.removeItem(HAS_LOGGED_IN_STORAGE_KEY);
    isLoading$ = new BehaviorSubject(true);
    isAuthenticated$ = new BehaviorSubject(false);
    user$ = new BehaviorSubject<Record<string, unknown> | null>(null);
    error$ = new Subject<Error>();
    loginWithRedirect = vi.fn().mockName('loginWithRedirect').mockReturnValue(of(void 0));

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: AuthService,
          useValue: {
            isLoading$,
            isAuthenticated$,
            user$,
            error$,
            loginWithRedirect,
          },
        },
        AuthServiceWrapper,
      ],
    });
  });

  afterEach(() => {
    localStorage.removeItem(AUTH_AVATAR_STORAGE_KEY);
    localStorage.removeItem(HAS_LOGGED_IN_STORAGE_KEY);
    document.documentElement.classList.remove('has-cached-avatar');
  });

  it('seeds avatarUrl from localStorage before Auth0 resolves', () => {
    localStorage.setItem(AUTH_AVATAR_STORAGE_KEY, 'https://cdn.example/avatar.png');

    const wrapper = TestBed.inject(AuthServiceWrapper);

    expect(wrapper.avatarUrl()).toBe('https://cdn.example/avatar.png');
    expect(document.documentElement.classList.contains('has-cached-avatar')).toBe(true);
  });

  it('persists the Auth0 picture when the user arrives', () => {
    const wrapper = TestBed.inject(AuthServiceWrapper);

    user$.next({
      picture: 'https://cdn.example/me.png',
      'https://api.cultpodcasts.com/roles': ['Curator'],
    });

    expect(wrapper.avatarUrl()).toBe('https://cdn.example/me.png');
    expect(localStorage.getItem(AUTH_AVATAR_STORAGE_KEY)).toBe('https://cdn.example/me.png');
    expect(localStorage.getItem(HAS_LOGGED_IN_STORAGE_KEY)).toBe('true');
  });

  it('does not clear the cached avatar while Auth0 is still loading', () => {
    localStorage.setItem(AUTH_AVATAR_STORAGE_KEY, 'https://cdn.example/me.png');
    const wrapper = TestBed.inject(AuthServiceWrapper);

    // Typical restore: authenticated stays false until loading completes.
    isAuthenticated$.next(false);
    expect(wrapper.avatarUrl()).toBe('https://cdn.example/me.png');
    expect(localStorage.getItem(AUTH_AVATAR_STORAGE_KEY)).toBe('https://cdn.example/me.png');
  });

  it('clears a stale cached avatar when Auth0 finishes signed out', () => {
    localStorage.setItem(AUTH_AVATAR_STORAGE_KEY, 'https://cdn.example/stale.png');
    const wrapper = TestBed.inject(AuthServiceWrapper);
    expect(wrapper.avatarUrl()).toBe('https://cdn.example/stale.png');

    isAuthenticated$.next(false);
    user$.next(null);
    isLoading$.next(false);

    expect(wrapper.avatarUrl()).toBeNull();
    expect(localStorage.getItem(AUTH_AVATAR_STORAGE_KEY)).toBeNull();
  });

  it('keeps the cached avatar when Auth0 finishes signed in', () => {
    localStorage.setItem(AUTH_AVATAR_STORAGE_KEY, 'https://cdn.example/me.png');
    const wrapper = TestBed.inject(AuthServiceWrapper);

    user$.next({
      picture: 'https://cdn.example/me.png',
      'https://api.cultpodcasts.com/roles': ['Curator'],
    });
    isAuthenticated$.next(true);
    isLoading$.next(false);

    expect(wrapper.avatarUrl()).toBe('https://cdn.example/me.png');
    expect(localStorage.getItem(AUTH_AVATAR_STORAGE_KEY)).toBe('https://cdn.example/me.png');
  });

  it('clearCachedAvatar removes storage and the signal for logout', () => {
    const wrapper = TestBed.inject(AuthServiceWrapper);
    user$.next({ picture: 'https://cdn.example/me.png' });
    expect(document.documentElement.classList.contains('has-cached-avatar')).toBe(true);

    wrapper.clearCachedAvatar();

    expect(wrapper.avatarUrl()).toBeNull();
    expect(localStorage.getItem(AUTH_AVATAR_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.classList.contains('has-cached-avatar')).toBe(false);
  });

  it('loginWithRedirectToCurrentPage passes appState.target for post-login return', () => {
    const wrapper = TestBed.inject(AuthServiceWrapper);

    wrapper.loginWithRedirectToCurrentPage();

    expect(loginWithRedirect).toHaveBeenCalledTimes(1);
    expect(loginWithRedirect).toHaveBeenCalledWith({
      appState: { target: expect.stringMatching(/^\//) },
    });
    const target = loginWithRedirect.mock.calls[0][0].appState.target as string;
    expect(target.startsWith('//')).toBe(false);
  });

  it('loginWithRedirects once on missing_refresh_token', () => {
    TestBed.inject(AuthServiceWrapper);

    error$.next(
      Object.assign(new Error("Missing Refresh Token (audience: 'https://api.cultpodcasts.com/')"), {
        error: 'missing_refresh_token',
      })
    );
    error$.next(
      Object.assign(new Error("Missing Refresh Token (audience: 'https://api.cultpodcasts.com/')"), {
        error: 'missing_refresh_token',
      })
    );

    expect(loginWithRedirect).toHaveBeenCalledTimes(1);
    expect(loginWithRedirect).toHaveBeenCalledWith({
      appState: { target: expect.stringMatching(/^\//) },
    });
  });

  it('does not loginWithRedirect for unrelated Auth0 errors', () => {
    TestBed.inject(AuthServiceWrapper);

    error$.next(Object.assign(new Error('Login required'), { error: 'login_required' }));

    expect(loginWithRedirect).not.toHaveBeenCalled();
  });
});
