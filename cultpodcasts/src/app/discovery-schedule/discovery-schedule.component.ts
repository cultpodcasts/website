import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { DiscoverySchedule, DiscoveryScheduleNextRun, DiscoveryScheduleUpdate } from './discovery-schedule.interface';

@Component({
  selector: 'app-discovery-schedule',
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatSlideToggleModule,
    FormsModule
  ],
  templateUrl: './discovery-schedule.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './discovery-schedule.component.sass'
})
export class DiscoveryScheduleComponent {
  readonly slotChoices: string[] = DiscoveryScheduleComponent.buildSlotChoices();

  isLoading = true;
  isSaving = false;
  isInError = false;
  errorMessage = '';
  enabled = true;
  isDefault = false;
  timeZoneId = 'GMT Standard Time';
  selected = new Set<string>(['08:00', '22:00']);
  nextRuns: DiscoveryScheduleNextRun[] = [];

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<DiscoveryScheduleComponent, { saved?: boolean }>
  ) { }

  async ngOnInit() {
    await this.load();
  }

  close() {
    this.dialogRef.close({ saved: false });
  }

  isSelected(slot: string): boolean {
    return this.selected.has(slot);
  }

  toggleSlot(slot: string) {
    if (this.selected.has(slot)) {
      this.selected.delete(slot);
    } else {
      this.selected.add(slot);
    }
    this.selected = new Set(this.selected);
  }

  get canSave(): boolean {
    return !this.isLoading && !this.isSaving && this.selected.size > 0;
  }

  async onSave() {
    if (!this.canSave) {
      return;
    }

    this.isSaving = true;
    this.isInError = false;
    this.errorMessage = '';

    const body: DiscoveryScheduleUpdate = {
      runTimes: [...this.selected].sort(),
      enabled: this.enabled,
      timeZoneId: this.timeZoneId
    };

    try {
      const headers = await this.authHeaders();
      if (!headers) {
        this.isInError = true;
        this.errorMessage = 'Could not get admin token.';
        this.isSaving = false;
        return;
      }

      const resp = await firstValueFrom(
        this.http.put<DiscoverySchedule>(
          new URL('/discovery-schedule', environment.api).toString(),
          body,
          { headers, observe: 'response' }
        )
      );

      if (resp.status === 200 && resp.body) {
        this.apply(resp.body);
        this.isSaving = false;
        this.dialogRef.close({ saved: true });
        return;
      }

      this.isInError = true;
      this.errorMessage = 'Save failed.';
      this.isSaving = false;
    } catch (error: any) {
      console.error(error);
      this.isInError = true;
      this.errorMessage = error?.error?.error ?? 'Save failed.';
      this.isSaving = false;
    }
  }

  private async load() {
    this.isLoading = true;
    this.isInError = false;
    this.errorMessage = '';

    try {
      const headers = await this.authHeaders();
      if (!headers) {
        this.isInError = true;
        this.errorMessage = 'Could not get admin token.';
        this.isLoading = false;
        return;
      }

      const resp = await firstValueFrom(
        this.http.get<DiscoverySchedule>(
          new URL('/discovery-schedule', environment.api).toString(),
          { headers, observe: 'response' }
        )
      );

      if (resp.status === 200 && resp.body) {
        this.apply(resp.body);
      } else {
        this.isInError = true;
        this.errorMessage = 'Failed to load schedule.';
      }
    } catch (error) {
      console.error(error);
      this.isInError = true;
      this.errorMessage = 'Failed to load schedule.';
    } finally {
      this.isLoading = false;
    }
  }

  private apply(schedule: DiscoverySchedule) {
    this.enabled = schedule.enabled;
    this.isDefault = schedule.isDefault;
    this.timeZoneId = schedule.timeZoneId;
    this.selected = new Set(schedule.runTimes ?? []);
    this.nextRuns = schedule.nextRuns ?? [];
  }

  private async authHeaders(): Promise<HttpHeaders | undefined> {
    try {
      const token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
        authorizationParams: {
          audience: `https://api.cultpodcasts.com/`,
          scope: 'admin'
        }
      }));
      if (!token) {
        return undefined;
      }
      return new HttpHeaders().set('Authorization', 'Bearer ' + token);
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  private static buildSlotChoices(): string[] {
    const slots: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      for (const minute of [0, 30]) {
        slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
    }
    return slots;
  }

  formatNextRun(run: DiscoveryScheduleNextRun): string {
    return run.slotId;
  }
}
