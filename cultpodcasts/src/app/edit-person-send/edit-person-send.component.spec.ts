import { HttpResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { CurationSubmitService } from '../curation-submit.service';
import { Person } from '../person.interface';
import { EditPersonSendComponent } from './edit-person-send.component';

describe('EditPersonSendComponent', () => {
  let fixture: ComponentFixture<EditPersonSendComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let createPerson: ReturnType<typeof vi.fn>;
  let getPerson: ReturnType<typeof vi.fn>;

  const created: Person = { id: 'person-from-get', name: 'Alpha Beta' };
  const commandBody: Person = { id: 'person-from-command', name: 'Alpha Beta' };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    createPerson = vi.fn();
    getPerson = vi.fn();
    await TestBed.configureTestingModule({
      imports: [EditPersonSendComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { create: true } },
        {
          provide: CurationSubmitService,
          useValue: { createPerson, getPerson, patchPerson: vi.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EditPersonSendComponent);
    fixture.detectChanges();
  });

  it('loads the created person with GET after 202 and ignores the command body', () => {
    createPerson.mockReturnValue(of(new HttpResponse({ status: 202, body: commandBody })));
    getPerson.mockReturnValue(of(created));

    fixture.componentInstance.submit('', { id: '', name: 'Alpha Beta' }, true);

    expect(createPerson).toHaveBeenCalledWith({ id: '', name: 'Alpha Beta' });
    expect(getPerson).toHaveBeenCalledWith('Alpha Beta');
    expect(dialogRef.close).toHaveBeenCalledWith({
      updated: true,
      person: created,
      personName: 'Alpha Beta',
    });
    expect(fixture.componentInstance.sendError()).toBe(false);
  });

  it('keeps the send dialog open when create is not 202', () => {
    createPerson.mockReturnValue(of(new HttpResponse({ status: 200, body: commandBody })));

    fixture.componentInstance.submit('', { id: '', name: 'Alpha Beta' }, true);

    expect(getPerson).not.toHaveBeenCalled();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(fixture.componentInstance.sendError()).toBe(true);
    expect(fixture.componentInstance.isSending()).toBe(false);
  });

  it('keeps the send dialog open when GET fails', () => {
    createPerson.mockReturnValue(of(new HttpResponse({ status: 202, body: commandBody })));
    getPerson.mockReturnValue(throwError(() => ({ status: 500 })));

    fixture.componentInstance.submit('', { id: '', name: 'Alpha Beta' }, true);

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(fixture.componentInstance.sendError()).toBe(true);
    expect(fixture.componentInstance.isSending()).toBe(false);
  });

  it('keeps the send dialog open when GET returns no id', () => {
    createPerson.mockReturnValue(of(new HttpResponse({ status: 202, body: null })));
    getPerson.mockReturnValue(of({ id: '', name: 'Alpha Beta' }));

    fixture.componentInstance.submit('', { id: '', name: 'Alpha Beta' }, true);

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(fixture.componentInstance.sendError()).toBe(true);
    expect(fixture.componentInstance.isSending()).toBe(false);
  });
});
