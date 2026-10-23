import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface UnsupportedLanguageSignal {
  field: string;
  label: string;
  excerpt: string;
  reason: string;
}

export interface UnsupportedLanguagePrompt {
  code: string;
  name: string;
  signals: UnsupportedLanguageSignal[];
}

/** add = put the language on the supported list, then create with that default. */
export type UnsupportedLanguageAnswer = 'add' | 'cancel' | 'continue';

@Component({
  selector: 'app-unsupported-language-dialog',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './unsupported-language-dialog.component.html',
  styleUrl: './unsupported-language-dialog.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UnsupportedLanguageDialogComponent {
  readonly data = inject<UnsupportedLanguagePrompt>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<UnsupportedLanguageDialogComponent, UnsupportedLanguageAnswer>);

  choose(answer: UnsupportedLanguageAnswer) {
    this.dialogRef.close(answer);
  }
}
