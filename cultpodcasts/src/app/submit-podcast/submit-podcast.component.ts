import { Component, OnInit } from '@angular/core';
import { FormGroup, Validators, FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from "@angular/material/dialog";
import { UrlValidator } from '../url.validator';
import { SimplePodcast } from '../simple-podcast.interface';
import { Observable } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-submit-podcast',
  templateUrl: './submit-podcast.component.html',
  styleUrls: ['./submit-podcast.component.sass'],
  imports: [
    MatDialogModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatExpansionModule,
    MatAutocompleteModule,
    MatOptionModule,
    MatButtonModule
  ]
})
export class SubmitPodcastComponent implements OnInit {
  form!: FormGroup;
  advancedOpenState: boolean = false;
  podcast = new FormControl();
  url = new FormControl()
  filteredOptions: Observable<SimplePodcast[]> | undefined;
  options: SimplePodcast[] | undefined;

  constructor(
    private dialogRef: MatDialogRef<SubmitPodcastComponent>) {
  }

  ngOnInit() {
    this.url.addValidators([
      Validators.required,
      UrlValidator.isValid()
    ]);
    this.form = new FormGroup({
      url: this.url,
      podcast: this.podcast
    });
  }

  displayFn(podcast: SimplePodcast): string {
    return podcast && podcast.name ? podcast.name : '';
  }

  save() {
    if (this.form.valid) {
      this.dialogRef.close(
        this.form.value
      );
    }
  }

  close() {
    this.dialogRef.close();
  }
}
