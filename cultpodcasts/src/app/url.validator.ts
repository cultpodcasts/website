import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { isSubmittablePodcastUrl } from './podcast-url-matcher';

export class UrlValidator {
  static isValid(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }
      let validUrl = true;
      try {
        new URL(control.value)
      } catch {
        if (!/^\w+\:\/\//.test(control.value)) {
          try {
            let url = "https://" + control.value;
            new URL(url)
          } catch {
            validUrl = false;
          }
        } else {
          validUrl = false;
        }
      }
      return validUrl ? null : { invalidUrl: true };
    };
  }

  static isSubmittable(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }
      return isSubmittablePodcastUrl(String(control.value)) ? null : { unrecognisedUrl: true };
    };
  }
}
