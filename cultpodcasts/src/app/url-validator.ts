import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

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
            validUrl = false;
          }
          return validUrl ? null : { invalidUrl: true };
        };
      }
}
