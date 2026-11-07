import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { AmbiguousNameCandidate } from './ambiguous-name-candidate';
import { resolveAmbiguousEditRows } from './resolve-ambiguous-edit-rows';

describe('resolveAmbiguousEditRows', () => {
  const firstId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const secondId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  function candidate(row: { id?: string | null; name?: string; youTubeChannelId?: string }): AmbiguousNameCandidate {
    return {
      id: row.id ?? '',
      name: row.name,
      youTubeChannelId: row.youTubeChannelId
    };
  }

  it('loads each id, opens the picker with candidates, and returns the picked row', async () => {
    const rows = [
      { id: firstId, name: 'Desk', youTubeChannelId: 'UC-first' },
      { id: secondId, name: 'Desk', youTubeChannelId: 'UC-second' }
    ];
    const loadById = vi.fn(async (id: string) => rows.find((r) => r.id === id) ?? null);
    const open = vi.fn(() => ({
      afterClosed: () => of({ id: secondId, name: 'Desk', youTubeChannelId: 'UC-second' })
    }));
    const dialog = { open } as unknown as MatDialog;

    const result = await resolveAmbiguousEditRows(
      [firstId, secondId],
      loadById,
      dialog,
      'Desk',
      {
        toCandidate: candidate,
        title: 'Choose podcast',
        itemNounPlural: 'podcasts'
      }
    );

    expect(loadById).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalled();
    const openArgs = open.mock.calls[0] as unknown as [
      unknown,
      {
        data: {
          title?: string;
          itemNounPlural?: string;
          candidates: AmbiguousNameCandidate[];
        };
      }
    ];
    const data = openArgs[1].data;
    expect(data.title).toBe('Choose podcast');
    expect(data.itemNounPlural).toBe('podcasts');
    expect(data.candidates).toEqual([
      { id: firstId, name: 'Desk', youTubeChannelId: 'UC-first' },
      { id: secondId, name: 'Desk', youTubeChannelId: 'UC-second' }
    ]);
    expect(result).toEqual({ kind: 'picked', row: rows[1] });
  });

  it('returns cancelled when the curator closes the picker without a pick', async () => {
    const loadById = vi.fn(async (id: string) => ({ id, name: 'Desk' }));
    const dialog = {
      open: vi.fn(() => ({ afterClosed: () => of(undefined) }))
    } as unknown as MatDialog;

    const result = await resolveAmbiguousEditRows(
      [firstId, secondId],
      loadById,
      dialog,
      'Desk',
      { toCandidate: candidate }
    );

    expect(result).toEqual({ kind: 'cancelled' });
  });

  it('returns unrecoverable when any id fails to load', async () => {
    const loadById = vi.fn(async (id: string) => (id === firstId ? { id, name: 'Desk' } : null));
    const open = vi.fn();
    const dialog = { open } as unknown as MatDialog;

    const result = await resolveAmbiguousEditRows(
      [firstId, secondId],
      loadById,
      dialog,
      'Desk',
      { toCandidate: candidate }
    );

    expect(result).toEqual({ kind: 'unrecoverable' });
    expect(open).not.toHaveBeenCalled();
  });
});
