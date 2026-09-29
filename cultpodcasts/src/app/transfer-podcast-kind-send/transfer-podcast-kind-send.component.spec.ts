import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { CatalogueParentKind } from '../catalogue-parent-kind.enum';
import { CurationSubmitService } from '../curation-submit.service';
import { PodcastKindTransferResponse } from '../podcast-kind-transfer-response.interface';
import { TransferPodcastKindSendComponent } from './transfer-podcast-kind-send.component';

describe('TransferPodcastKindSendComponent', () => {
  let fixture: ComponentFixture<TransferPodcastKindSendComponent>;
  let component: TransferPodcastKindSendComponent;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let postPodcastKind: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    postPodcastKind = vi.fn();
    await TestBed.configureTestingModule({
      imports: [TransferPodcastKindSendComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: CurationSubmitService, useValue: { postPodcastKind: postPodcastKind } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TransferPodcastKindSendComponent);
    component = fixture.componentInstance;
  });

  it('closes transferred:true with targetKind on 202 even when failureIndexingPlayables', () => {
    const body: PodcastKindTransferResponse = {
      parentId: 'parent-1',
      targetKind: CatalogueParentKind.TvShow,
      failureIndexingPlayables: true
    };
    postPodcastKind.mockReturnValue(of({ status: 202, body: body }));

    component.submit('podcast-1', CatalogueParentKind.TvShow);

    expect(dialogRef.close).toHaveBeenCalledWith({
      transferred: true,
      targetKind: CatalogueParentKind.TvShow,
      parentId: 'parent-1',
      response: body
    });
    expect(component.sendError()).toBe(false);
  });

  it('sets sendError on HTTP error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    postPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' })));

    component.submit('podcast-1', CatalogueParentKind.NewsOrganisation);

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.sendError()).toBe(true);
    expect(component.isSending()).toBe(false);
    errorSpy.mockRestore();
  });
});
