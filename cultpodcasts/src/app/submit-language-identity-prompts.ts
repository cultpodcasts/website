import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import {
  AmbiguousIdentityAnswer,
  AmbiguousIdentityDialogComponent,
  AmbiguousIdentityPrompt
} from './ambiguous-identity-dialog/ambiguous-identity-dialog.component';
import {
  DiscoveryIdentityDecision,
  DiscoveryLanguageDecision
} from './submit-discovery-response.interface';
import {
  UnsupportedLanguageAnswer,
  UnsupportedLanguageDialogComponent,
  UnsupportedLanguagePrompt
} from './unsupported-language-dialog/unsupported-language-dialog.component';

const GATE_DIALOG_OPTIONS = {
  disableClose: true,
  autoFocus: true,
  width: '36rem'
} as const;

/** Single-item language prompt (send-podcast /submit gate). */
export function promptUnsupportedLanguage(
  dialog: MatDialog,
  prompt: UnsupportedLanguagePrompt
): Promise<UnsupportedLanguageAnswer | undefined> {
  return firstValueFrom(
    dialog.open<UnsupportedLanguageDialogComponent, UnsupportedLanguagePrompt, UnsupportedLanguageAnswer>(
      UnsupportedLanguageDialogComponent,
      { data: prompt, ...GATE_DIALOG_OPTIONS }
    ).afterClosed()
  );
}

/** Single-item identity prompt (send-podcast /submit gate). */
export function promptAmbiguousIdentity(
  dialog: MatDialog,
  prompt: AmbiguousIdentityPrompt
): Promise<AmbiguousIdentityAnswer | undefined> {
  return firstValueFrom(
    dialog.open<AmbiguousIdentityDialogComponent, AmbiguousIdentityPrompt, AmbiguousIdentityAnswer>(
      AmbiguousIdentityDialogComponent,
      { data: prompt, ...GATE_DIALOG_OPTIONS }
    ).afterClosed()
  );
}

export interface UnsupportedLanguagesPromptResult {
  answers: Map<string, UnsupportedLanguageAnswer>;
  /** Current create-set after dropping cancelled prompted ids (untouched ids kept). */
  idsToCreate: string[];
  /** Decisions to POST for ids that answered add/continue (empty when none). */
  languageDecisions: Record<string, 'add' | 'continue'>;
  cancelledIds: string[];
}

/**
 * Opens unsupported-language dialogs for each required discovery item and rebuilds the create id list.
 * Cancelled prompted ids are omitted from `idsToCreate` and from `languageDecisions`.
 */
export async function promptUnsupportedLanguages(
  dialog: MatDialog,
  required: DiscoveryLanguageDecision[],
  currentResultIds: string[]
): Promise<UnsupportedLanguagesPromptResult> {
  const answers = new Map<string, UnsupportedLanguageAnswer>();
  for (const item of required) {
    const answer = await promptUnsupportedLanguage(dialog, {
      code: item.code,
      name: item.name,
      signals: item.signals
    });
    answers.set(item.discoveryItemId, answer === 'add' || answer === 'continue' ? answer : 'cancel');
  }

  const promptedIds = new Set(required.map(item => item.discoveryItemId));
  const creating = required
    .map(item => ({ id: item.discoveryItemId, answer: answers.get(item.discoveryItemId)! }))
    .filter(item => item.answer === 'add' || item.answer === 'continue');
  const cancelledIds = required
    .map(item => item.discoveryItemId)
    .filter(id => !creating.some(item => item.id === id));
  const untouched = currentResultIds.filter(id => !promptedIds.has(id));
  const idsToCreate = [...untouched, ...creating.map(item => item.id)];
  const languageDecisions = Object.fromEntries(
    creating.map(item => [item.id, item.answer as 'add' | 'continue'])
  );

  return { answers, idsToCreate, languageDecisions, cancelledIds };
}

export interface AmbiguousIdentitiesPromptResult {
  answers: Map<string, AmbiguousIdentityAnswer>;
  idsToCreate: string[];
  identityDecisions: Record<string, 'select' | 'continue'>;
  selectedIdentityKeys: Record<string, string>;
  cancelledIds: string[];
}

/**
 * Opens ambiguous-identity dialogs for each required discovery item and rebuilds the create id list.
 * Cancelled prompted ids are omitted from `idsToCreate` and from decision maps.
 */
export async function promptAmbiguousIdentities(
  dialog: MatDialog,
  required: DiscoveryIdentityDecision[],
  currentResultIds: string[]
): Promise<AmbiguousIdentitiesPromptResult> {
  const answers = new Map<string, AmbiguousIdentityAnswer>();
  for (const item of required) {
    const answer = await promptAmbiguousIdentity(dialog, {
      target: item.target,
      query: item.query,
      candidates: item.candidates
    });
    answers.set(
      item.discoveryItemId,
      answer?.decision === 'select' || answer?.decision === 'continue'
        ? answer
        : { decision: 'cancel' }
    );
  }

  const promptedIds = new Set(required.map(item => item.discoveryItemId));
  const creating = required
    .map(item => ({ id: item.discoveryItemId, answer: answers.get(item.discoveryItemId)! }))
    .filter(item => item.answer.decision === 'select' || item.answer.decision === 'continue');
  const cancelledIds = required
    .map(item => item.discoveryItemId)
    .filter(id => !creating.some(item => item.id === id));
  const untouched = currentResultIds.filter(id => !promptedIds.has(id));
  const idsToCreate = [...untouched, ...creating.map(item => item.id)];
  const identityDecisions = Object.fromEntries(
    creating.map(item => [item.id, item.answer.decision as 'select' | 'continue'])
  );
  const selectedIdentityKeys = Object.fromEntries(
    creating
      .filter(item => item.answer.decision === 'select')
      .map(item => {
        const selected = item.answer as { decision: 'select'; key: string };
        return [item.id, selected.key];
      })
  );

  return { answers, idsToCreate, identityDecisions, selectedIdentityKeys, cancelledIds };
}
