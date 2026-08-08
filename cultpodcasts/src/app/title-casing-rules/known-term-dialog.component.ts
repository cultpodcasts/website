import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { KnownTerm } from './title-casing-rules.interface';

export interface KnownTermDialogData {
  term?: KnownTerm;
}

export interface KnownTermDialogResult {
  term: KnownTerm;
}

/** Flags accepted by KnownTermEntry / RegexOptions.Parse (comma-separated names). */
const REGEX_OPTION_FLAGS = [
  { name: 'IgnoreCase', label: 'Ignore case' },
  { name: 'Compiled', label: 'Compiled' },
  { name: 'CultureInvariant', label: 'Culture invariant' },
  { name: 'Multiline', label: 'Multiline' },
  { name: 'Singleline', label: 'Singleline' },
  { name: 'ExplicitCapture', label: 'Explicit capture' },
  { name: 'IgnorePatternWhitespace', label: 'Ignore pattern whitespace' }
] as const;

const DEFAULT_OPTION_NAMES = ['IgnoreCase', 'Compiled'] as const;

@Component({
  selector: 'app-known-term-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule
  ],
  templateUrl: './known-term-dialog.component.html',
  styleUrl: './known-term-dialog.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KnownTermDialogComponent {
  readonly regexOptionFlags = REGEX_OPTION_FLAGS;

  literal: string;
  pattern: string;
  /** Selected RegexOptions flag names. */
  selectedOptions: Record<string, boolean>;

  constructor(
    @Inject(MAT_DIALOG_DATA) protected data: KnownTermDialogData,
    private dialogRef: MatDialogRef<KnownTermDialogComponent, KnownTermDialogResult>
  ) {
    this.literal = data.term?.literal ?? '';
    this.pattern = data.term?.pattern ?? '';
    this.selectedOptions = this.parseOptions(data.term?.options);
  }

  get canSave(): boolean {
    return !!this.literal.trim() && !!this.pattern.trim();
  }

  close() {
    this.dialogRef.close();
  }

  save() {
    if (!this.canSave) {
      return;
    }
    this.dialogRef.close({
      term: {
        literal: this.literal.trim(),
        pattern: this.pattern.trim(),
        options: this.serializeOptions()
      }
    });
  }

  private parseOptions(raw: string | null | undefined): Record<string, boolean> {
    const selected = Object.fromEntries(
      REGEX_OPTION_FLAGS.map(f => [f.name, false])
    ) as Record<string, boolean>;

    const names = (raw ?? DEFAULT_OPTION_NAMES.join(','))
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const source = names.length > 0 ? names : [...DEFAULT_OPTION_NAMES];
    for (const name of source) {
      const match = REGEX_OPTION_FLAGS.find(
        f => f.name.toLowerCase() === name.toLowerCase()
      );
      if (match) {
        selected[match.name] = true;
      }
    }
    return selected;
  }

  private serializeOptions(): string | null {
    const names = REGEX_OPTION_FLAGS
      .filter(f => this.selectedOptions[f.name])
      .map(f => f.name);
    return names.length > 0 ? names.join(', ') : null;
  }
}
