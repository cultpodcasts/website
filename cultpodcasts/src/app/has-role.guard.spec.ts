import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRouteSnapshot, GuardResult, MaybeAsync, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom, isObservable } from 'rxjs';
import { AuthService } from '@auth0/auth0-angular';
import { vi } from 'vitest';
import { hasRoleGuard } from './has-role.guard';
import { AuthServiceWrapper } from './auth-service-wrapper.class';

describe('hasRoleGuard', () => {
  let isLoading$: BehaviorSubject<boolean>;
  let user$: BehaviorSubject<Record<string, unknown> | null>;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    isLoading$ = new BehaviorSubject(true);
    user$ = new BehaviorSubject<Record<string, unknown> | null>(null);
    navigate = vi.fn().mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: AuthServiceWrapper,
          useValue: {
            authService: {
              isLoading$,
              user$,
            } as unknown as AuthService,
          },
        },
        { provide: Router, useValue: { navigate } },
      ],
    });
  });

  function runGuard(roles: string[] = ['Curator']): MaybeAsync<GuardResult> {
    const route = { data: { roles } } as unknown as ActivatedRouteSnapshot;
    const state = {} as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => hasRoleGuard(route, state));
  }

  async function resolveGuard(roles?: string[]): Promise<GuardResult> {
    const result = runGuard(roles);
    return isObservable(result) ? firstValueFrom(result) : await result;
  }

  it('allows the route on the server so SSR HTML matches the URL (hydration)', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
        {
          provide: AuthServiceWrapper,
          useValue: {
            authService: {
              isLoading$: new BehaviorSubject(false),
              user$: new BehaviorSubject(null),
            } as unknown as AuthService,
          },
        },
        { provide: Router, useValue: { navigate } },
      ],
    });

    expect(runGuard()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('waits for Auth0 to finish loading before rejecting a null user', async () => {
    const pending = resolveGuard();

    // Still loading — must not navigate yet.
    expect(navigate).not.toHaveBeenCalled();

    user$.next({
      'https://api.cultpodcasts.com/roles': ['Curator'],
    });
    isLoading$.next(false);

    await expect(pending).resolves.toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('allows a curator once loading completes', async () => {
    user$.next({
      'https://api.cultpodcasts.com/roles': ['Curator'],
    });
    isLoading$.next(false);

    await expect(resolveGuard()).resolves.toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('sends non-curators to /unauthorised after loading completes', async () => {
    user$.next({
      'https://api.cultpodcasts.com/roles': ['Submitter'],
    });
    isLoading$.next(false);

    await expect(resolveGuard()).resolves.toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/unauthorised']);
  });

  it('sends anonymous users to /unauthorised after loading completes', async () => {
    user$.next(null);
    isLoading$.next(false);

    await expect(resolveGuard()).resolves.toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/unauthorised']);
  });
});
