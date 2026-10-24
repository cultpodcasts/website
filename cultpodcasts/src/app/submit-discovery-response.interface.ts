import { SubmitDiscoveryItemResult } from "./submit-discovery-item-result.interface";
import { AmbiguousIdentityCandidate } from "./ambiguous-identity-dialog/ambiguous-identity-dialog.component";
import { UnsupportedLanguageSignal } from "./unsupported-language-dialog/unsupported-language-dialog.component";

export interface DiscoveryLanguageDecision {
    discoveryItemId: string;
    code: string;
    name: string;
    signals: UnsupportedLanguageSignal[];
}

export interface DiscoveryIdentityDecision {
    discoveryItemId: string;
    target: string;
    query: string;
    candidates: AmbiguousIdentityCandidate[];
}

export interface SubmitDiscoveryResponse {
    message: string;
    errorsOccurred: boolean;
    results: SubmitDiscoveryItemResult[];
    languageDecisionsRequired?: DiscoveryLanguageDecision[];
    identityDecisionsRequired?: DiscoveryIdentityDecision[];
}