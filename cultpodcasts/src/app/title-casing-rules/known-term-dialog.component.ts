import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
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

@Component({
  selector: 'app-known-term-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule
  ],
  templateUrl: './known-term-dialog.component.html',
  styleUrl: './known-term-dialog.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KnownTermDialogComponent {
  literal: string;
  pattern: string;
  options: string;

  constructor(
    @Inject(MAT_DIALOG_DATA) protected data: KnownTermDialogData,
    private dialogRef: MatDialogRef<KnownTermDialogComponent, KnownTermDialogResult>
  ) {
    this.literal = data.term?.literal ?? '';
    this.pattern = data.term?.pattern ?? '';
    this.options = data.term?.options ?? 'IgnoreCase,Compiled';
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
        options: this.options.trim() || null
      }
    });
  }
}
