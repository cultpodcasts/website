import { HttpErrorResponse } from '@angular/common/http';
import {
  attachTrailerErrorMessage,
  creatableParentName,
  idTargetFromText,
  SuggestionQueryGuard,
  trailerTargetFromText
} from './trailer-target';

const parentId = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d';

describe('trailer-target (shared by the film and TV show attach dialogs)', () => {
  describe('idTargetFromText', () => {
    it('is the lower-cased id for a pasted GUID in any case, trimmed, and null for any other text', () => {
      expect(idTargetFromText(`  ${parentId.toUpperCase()} `)).toEqual({ kind: 'id', id: parentId });
      expect(idTargetFromText('Synthetic Show')).toBeNull();
      expect(idTargetFromText(`${parentId} extra`)).toBeNull();
      expect(idTargetFromText('')).toBeNull();
    });
  });

  describe('trailerTargetFromText', () => {
    it.each(['', '   ', 'Synthetic/Show'])('is null for %j (blank, or a name with a slash)', text => {
      expect(trailerTargetFromText(text, { create: false })).toBeNull();
      expect(trailerTargetFromText(text, { create: true })).toBeNull();
    });

    it('is an id target for a pasted id even when create is ticked', () => {
      expect(trailerTargetFromText(parentId, { create: true, publisher: 'Synthetic Network' }))
        .toEqual({ kind: 'id', id: parentId });
    });

    it('is a name to resolve when create is off', () => {
      expect(trailerTargetFromText('  Synthetic Show ', { create: false, publisher: 'Ignored' }))
        .toEqual({ kind: 'name', name: 'Synthetic Show' });
    });

    it('is a name to create, with the trimmed publisher only when there is one', () => {
      expect(trailerTargetFromText('New Show', { create: true, publisher: '  Synthetic Network ' }))
        .toEqual({ kind: 'create', name: 'New Show', publisher: 'Synthetic Network' });
      expect(trailerTargetFromText('New Show', { create: true, publisher: '   ' }))
        .toEqual({ kind: 'create', name: 'New Show' });
      expect(trailerTargetFromText('New Show', { create: true }))
        .toEqual({ kind: 'create', name: 'New Show' });
    });
  });

  describe('creatableParentName', () => {
    it('is the trimmed name when it is at least 2 characters, not an id, and has no slash', () => {
      expect(creatableParentName('  Synthetic Film ')).toBe('Synthetic Film');
      expect(creatableParentName('A')).toBeNull();
      expect(creatableParentName(parentId)).toBeNull();
      expect(creatableParentName('Synthetic/Film')).toBeNull();
    });
  });

  describe('SuggestionQueryGuard', () => {
    it('treats only the lookup begun last as current', () => {
      const guard = new SuggestionQueryGuard();

      const first = guard.begin();
      expect(guard.isLatest(first)).toBe(true);

      const second = guard.begin();
      expect(guard.isLatest(first)).toBe(false);
      expect(guard.isLatest(second)).toBe(true);
    });
  });

  describe('attachTrailerErrorMessage', () => {
    it.each([
      ['film', 400, undefined, 'The episode cannot be attached as a trailer.'],
      ['film', 404, undefined, 'The episode or film was not found. The episode may already be a trailer of a film.'],
      ['film', 409, undefined, 'This episode is already a trailer of another film, or is being attached right now. Try again shortly.'],
      ['film', 500, undefined, 'An error occurred attaching the trailer. Sending again resumes an interrupted attach.'],
      ['tv', 400, undefined, 'The episode cannot be attached as a TV trailer/clip.'],
      ['tv', 404, undefined, 'The episode or TV show was not found. The episode may already be a trailer of a TV show.'],
      ['tv', 409, undefined, 'This episode is already a trailer of another TV show, or is being attached right now. Try again shortly.'],
      ['tv', 500, undefined, 'An error occurred attaching the TV trailer/clip. Sending again resumes an interrupted attach.']
    ] as const)('%s attach error %s → %s', (parent, status, error, expected) => {
      expect(attachTrailerErrorMessage(new HttpErrorResponse({ status, error }), parent)).toBe(expected);
    });

    it.each(['film', 'tv'] as const)('shows the server text for a %s 400, 404 or 409, but not for a 500', parent => {
      for (const status of [400, 404, 409]) {
        expect(attachTrailerErrorMessage(new HttpErrorResponse({ status, error: { error: 'Server says no' } }), parent))
          .toBe('Server says no');
      }
      expect(attachTrailerErrorMessage(new HttpErrorResponse({ status: 500, error: { error: 'Server says no' } }), parent))
        .toContain('resumes');
    });
  });
});
