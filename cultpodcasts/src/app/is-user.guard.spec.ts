import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { AuthService } from '@auth0/auth0-angular';
import { vi } from 'vitest';
import { isUserGuard } from './is-user.guard';
import { AuthServiceWrapper } from './auth-service-wrapper.class';

describe('isUserGuard', () => {
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

  function runGuard(): Observable<boolean> {
    const route = {} as ActivatedRouteSnapshot;
    const state = {} as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => isUserGuard(route, state)) as Observable<boolean>;
  }

  it('waits for Auth0 to finish loading before rejecting', async () => {
    const pending = firstValueFrom(runGuard());
    expect(navigate).not.toHaveBeenCalled();

    user$.next({ sub: 'auth0|1' });
    isLoading$.next(false);

    await expect(pending).resolves.toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('sends anonymous users to /unauthorised after loading completes', async () => {
    user$.next(null);
    isLoading$.next(false);

    await expect(firstValueFrom(runGuard())).resolves.toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/unauthorised']);
  });
});
