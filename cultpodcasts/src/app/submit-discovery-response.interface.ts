import { SubmitDiscoveryItemResult } from "./submit-discovery-item-result.interface";
import { UnsupportedLanguageSignal } from "./unsupported-language-dialog/unsupported-language-dialog.component";

export interface DiscoveryLanguageDecision {
    discoveryItemId: string;
    code: string;
    name: string;
    signals: UnsupportedLanguageSignal[];
}

export interface SubmitDiscoveryResponse {
    message: string;
    errorsOccurred: boolean;
    results: SubmitDiscoveryItemResult[];
    languageDecisionsRequired?: DiscoveryLanguageDecision[];
}