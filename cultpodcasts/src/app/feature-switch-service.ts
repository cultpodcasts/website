import { Injectable } from "@angular/core";
import { FeatureSwitch } from "./feature-switch.enum";

@Injectable({ providedIn: `root` })
export class FeatureSwitchService {
    public IsEnabled(featureSwitch: FeatureSwitch): boolean {
        switch (featureSwitch) {
            case FeatureSwitch.auth0:
                return true;
            case FeatureSwitch.socials:
                return true;
            case FeatureSwitch.reddit:
                return false;
            case FeatureSwitch.redditPost:
                return false;
            default:
                return false;
        }
    }
}
