import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
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

  beforeEach(() => {
    localStorage.removeItem(AUTH_AVATAR_STORAGE_KEY);
    localStorage.removeItem(HAS_LOGGED_IN_STORAGE_KEY);
    isLoading$ = new BehaviorSubject(true);
    isAuthenticated$ = new BehaviorSubject(false);
    user$ = new BehaviorSubject<Record<string, unknown> | null>(null);

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
});
