import { Injectable } from "@angular/core";
import { FeatureSwitch } from "./feature-switch.enum";

@Injectable({ providedIn: `root` })
export class FeatureSwtichService {
    public IsEnabled(featureSwitch: FeatureSwitch): boolean {
        switch (featureSwitch) {
            case FeatureSwitch.auth0:
                return true;
            case FeatureSwitch.socials:
                return false;
            case FeatureSwitch.reddit:
                return true;
            default:
                return false;
        }
    }
}
