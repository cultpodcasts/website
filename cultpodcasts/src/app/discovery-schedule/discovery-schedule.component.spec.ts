import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { DiscoveryScheduleComponent } from './discovery-schedule.component';
import { DiscoverySchedule } from './discovery-schedule.interface';

describe('DiscoveryScheduleComponent', () => {
  let fixture: ComponentFixture<DiscoveryScheduleComponent>;
  let component: DiscoveryScheduleComponent;
  let httpMock: HttpTestingController;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  const scheduleUrl = new URL('/discovery-schedule', environment.api).toString();

  const loaded: DiscoverySchedule = {
    runTimes: ['09:00'],
    timeZoneId: 'GMT Standard Time',
    enabled: true,
    isDefault: false,
    nextRuns: [
      { slotId: '09:00', slotStartUtc: '2026-10-07T08:00:00Z', slotStartUk: '09:00' },
    ],
  };

  async function expectOneSoon(url: string) {
    for (let i = 0; i < 20; i++) {
      const matches = httpMock.match(url);
      if (matches.length === 1) {
        return matches[0];
      }
      await Promise.resolve();
    }
    return httpMock.expectOne(url);
  }

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [DiscoveryScheduleComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: dialogRef },
        {
          provide: AuthServiceWrapper,
          useValue: {
            authService: {
              getAccessTokenSilently: () => of('test-token'),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoveryScheduleComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);

    const initPromise = component.ngOnInit();
    const get = await expectOneSoon(scheduleUrl);
    expect(get.request.method).toBe('GET');
    get.flush(loaded);
    await initPromise;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('saves with PUT 202 then binds the following GET, not the command body', async () => {
    const pending = component.onSave();

    const put = await expectOneSoon(scheduleUrl);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({
      runTimes: ['09:00'],
      enabled: true,
      timeZoneId: 'GMT Standard Time',
    });
    put.flush(
      {
        ...loaded,
        runTimes: ['01:00'],
        nextRuns: [{ slotId: 'command', slotStartUtc: '', slotStartUk: '' }],
      },
      { status: 202, statusText: 'Accepted' }
    );

    const reload = await expectOneSoon(scheduleUrl);
    expect(reload.request.method).toBe('GET');
    reload.flush({
      ...loaded,
      runTimes: ['10:30'],
      nextRuns: [
        { slotId: '10:30', slotStartUtc: '2026-10-07T09:30:00Z', slotStartUk: '10:30' },
      ],
    });

    await pending;
    expect([...component.selected()]).toEqual(['10:30']);
    expect(component.nextRuns().map(run => run.slotId)).toEqual(['10:30']);
    expect(dialogRef.close).toHaveBeenCalledWith({ saved: true });
  });

  it('does not bind a discovery schedule body when the command is not 202', async () => {
    const pending = component.onSave();

    const put = await expectOneSoon(scheduleUrl);
    put.flush(
      {
        ...loaded,
        runTimes: ['01:00'],
        nextRuns: [{ slotId: 'command', slotStartUtc: '', slotStartUk: '' }],
      },
      { status: 200, statusText: 'OK' }
    );

    await pending;
    expect([...component.selected()]).toEqual(['09:00']);
    expect(component.isInError()).toBe(true);
    expect(component.errorMessage()).toBe('Save failed.');
    expect(httpMock.match(scheduleUrl)).toEqual([]);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
