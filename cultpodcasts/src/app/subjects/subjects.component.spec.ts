import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { MatTooltip } from '@angular/material/tooltip';
import { SubjectsComponent } from './subjects.component';

describe('SubjectsComponent reasons', () => {
  let fixture: ComponentFixture<SubjectsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubjectsComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(SubjectsComponent);
  });

  function tooltips(): MatTooltip[] {
    return fixture.debugElement
      .queryAll(By.directive(MatTooltip))
      .map(d => d.injector.get(MatTooltip));
  }

  it('shows the reason for each subject as an enabled tooltip', async () => {
    fixture.componentRef.setInput('subjects', ['Scientology', 'NXIVM']);
    fixture.componentRef.setInput('reasons', { Scientology: 'matched "Hubbard" in title' });
    fixture.detectChanges();
    await fixture.whenStable();

    const [scientology, nxivm] = tooltips();
    expect(scientology.message).toBe('matched "Hubbard" in title');
    expect(scientology.disabled).toBe(false);
    expect(nxivm.disabled).toBe(true);
  });

  it('renders plain chips with tooltips disabled when there are no reasons', async () => {
    fixture.componentRef.setInput('subjects', ['Scientology']);
    fixture.detectChanges();
    await fixture.whenStable();

    const all = tooltips();
    expect(fixture.nativeElement.querySelectorAll('.subject').length).toBe(1);
    expect(all.every(t => t.disabled)).toBe(true);
  });
});
