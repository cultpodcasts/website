import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { AmbiguousIdentityDialogComponent } from './ambiguous-identity-dialog/ambiguous-identity-dialog.component';
import {
  promptAmbiguousIdentities,
  promptAmbiguousIdentity,
  promptUnsupportedLanguage,
  promptUnsupportedLanguages
} from './submit-language-identity-prompts';
import { UnsupportedLanguageDialogComponent } from './unsupported-language-dialog/unsupported-language-dialog.component';

describe('submit-language-identity-prompts', () => {
  function dialogReturning(...answers: unknown[]): MatDialog {
    let i = 0;
    return {
      open: vi.fn().mockImplementation(() => ({
        afterClosed: () => of(answers[i++])
      }))
    } as unknown as MatDialog;
  }

  describe('promptUnsupportedLanguage', () => {
    it('opens the unsupported-language dialog with shared gate options', async () => {
      const dialog = dialogReturning('continue');
      const prompt = {
        code: 'is',
        name: 'Icelandic',
        signals: [{ field: 'episodeTitle', label: 'Episode title', excerpt: 'ekki', reason: 'Matched' }]
      };

      await expect(promptUnsupportedLanguage(dialog, prompt)).resolves.toBe('continue');

      expect(dialog.open).toHaveBeenCalledWith(UnsupportedLanguageDialogComponent, {
        data: prompt,
        disableClose: true,
        autoFocus: true,
        width: '36rem'
      });
    });
  });

  describe('promptAmbiguousIdentity', () => {
    it('opens the ambiguous-identity dialog with shared gate options', async () => {
      const dialog = dialogReturning({ decision: 'select', key: 'film:1' });
      const prompt = {
        target: 'film',
        query: 'Sample Title',
        candidates: [{ key: 'film:1', title: 'Sample Title', kind: 'film', source: 'tmdb', year: 2020 }]
      };

      await expect(promptAmbiguousIdentity(dialog, prompt)).resolves.toEqual({
        decision: 'select',
        key: 'film:1'
      });

      expect(dialog.open).toHaveBeenCalledWith(AmbiguousIdentityDialogComponent, {
        data: prompt,
        disableClose: true,
        autoFocus: true,
        width: '36rem'
      });
    });
  });

  describe('promptUnsupportedLanguages', () => {
    it('keeps untouched ids, builds decisions for continue/add, and lists cancelled ids', async () => {
      const dialog = dialogReturning('continue', 'cancel');
      const required = [
        { discoveryItemId: 'a', code: 'is', name: 'Icelandic', signals: [] },
        { discoveryItemId: 'b', code: 'cy', name: 'Welsh', signals: [] }
      ];

      const result = await promptUnsupportedLanguages(dialog, required, ['untouched', 'a', 'b']);

      expect(result.idsToCreate).toEqual(['untouched', 'a']);
      expect(result.languageDecisions).toEqual({ a: 'continue' });
      expect(result.cancelledIds).toEqual(['b']);
      expect(result.answers.get('a')).toBe('continue');
      expect(result.answers.get('b')).toBe('cancel');
    });

    it('treats a dismissed dialog as cancel', async () => {
      const dialog = dialogReturning(undefined);
      const required = [
        { discoveryItemId: 'a', code: 'is', name: 'Icelandic', signals: [] }
      ];

      const result = await promptUnsupportedLanguages(dialog, required, ['a']);

      expect(result.idsToCreate).toEqual([]);
      expect(result.languageDecisions).toEqual({});
      expect(result.cancelledIds).toEqual(['a']);
    });
  });

  describe('promptAmbiguousIdentities', () => {
    it('keeps untouched ids, maps select keys, and lists cancelled ids', async () => {
      const dialog = dialogReturning(
        { decision: 'select', key: 'film:1' },
        { decision: 'cancel' }
      );
      const required = [
        {
          discoveryItemId: 'a',
          target: 'film',
          query: 'A',
          candidates: [{ key: 'film:1', title: 'A', kind: 'film', source: 'tmdb' }]
        },
        {
          discoveryItemId: 'b',
          target: 'film',
          query: 'B',
          candidates: [{ key: 'film:2', title: 'B', kind: 'film', source: 'tmdb' }]
        }
      ];

      const result = await promptAmbiguousIdentities(dialog, required, ['untouched', 'a', 'b']);

      expect(result.idsToCreate).toEqual(['untouched', 'a']);
      expect(result.identityDecisions).toEqual({ a: 'select' });
      expect(result.selectedIdentityKeys).toEqual({ a: 'film:1' });
      expect(result.cancelledIds).toEqual(['b']);
    });

    it('includes continue without a selectedIdentityKeys entry', async () => {
      const dialog = dialogReturning({ decision: 'continue' });
      const required = [
        {
          discoveryItemId: 'a',
          target: 'film',
          query: 'A',
          candidates: [{ key: 'film:1', title: 'A', kind: 'film', source: 'tmdb' }]
        }
      ];

      const result = await promptAmbiguousIdentities(dialog, required, ['a']);

      expect(result.idsToCreate).toEqual(['a']);
      expect(result.identityDecisions).toEqual({ a: 'continue' });
      expect(result.selectedIdentityKeys).toEqual({});
      expect(result.cancelledIds).toEqual([]);
    });

    it('treats a dismissed dialog as cancel', async () => {
      const dialog = dialogReturning(undefined);
      const required = [
        {
          discoveryItemId: 'a',
          target: 'film',
          query: 'A',
          candidates: [{ key: 'film:1', title: 'A', kind: 'film', source: 'tmdb' }]
        }
      ];

      const result = await promptAmbiguousIdentities(dialog, required, ['a']);

      expect(result.idsToCreate).toEqual([]);
      expect(result.identityDecisions).toEqual({});
      expect(result.selectedIdentityKeys).toEqual({});
      expect(result.cancelledIds).toEqual(['a']);
      expect(result.answers.get('a')).toEqual({ decision: 'cancel' });
    });
  });
});
