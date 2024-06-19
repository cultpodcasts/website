import { Component, Inject, OnInit } from '@angular/core';
import { FormGroup, Validators, FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from "@angular/material/dialog";
import { UrlValidator } from '../url-validator';
import { PodcastsService } from '../podcasts.service';
import { ISimplePodcast } from '../ISimplePodcast';
import { Observable, map, startWith } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatExpansionModule } from '@angular/material/expansion';
import { NgIf, NgFor, AsyncPipe } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FeatureSwtichService } from '../FeatureSwitchService';
import { FeatureSwitch } from '../FeatureSwitch';

@Component({
  selector: 'app-submit-podcast',
  templateUrl: './submit-podcast.component.html',
  styleUrls: ['./submit-podcast.component.sass'],
  standalone: true,
  imports: [MatDialogModule, FormsModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, NgIf, MatExpansionModule, MatAutocompleteModule, NgFor, MatOptionModule, MatButtonModule, AsyncPipe]
})
export class SubmitPodcastComponent implements OnInit {

  form!: FormGroup;
  advancedOpenState: boolean = false;
  showAdvanced: boolean = false;
  podcast = new FormControl();
  url = new FormControl()
  filteredOptions: Observable<ISimplePodcast[]> | undefined;
  options: ISimplePodcast[] | undefined;

  constructor(
    private dialogRef: MatDialogRef<SubmitPodcastComponent>,
    private featureSwitchService: FeatureSwtichService,
    @Inject(MAT_DIALOG_DATA) data: any,
    private podcastService: PodcastsService) {
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
    if (this.featureSwitchService.IsEnabled(FeatureSwitch.submitPodcastSelector)) {
      var podcastResponse = this.podcastService.getPodcasts().then(result => {
        if (result.results) {
          this.options = result.results;
          this.filteredOptions = this.podcast.valueChanges
            .pipe(
              startWith(''),
              map(value => typeof value === 'string' ? value : value.name),
              map(name => name ? this._filter(name) : this.options!.slice())
            );
          this.showAdvanced = true;
        }
      });
    }
  }

  displayFn(podcast: ISimplePodcast): string {
    return podcast && podcast.name ? podcast.name : '';
  }

  private _filter(name: string): ISimplePodcast[] {
    const filterValue = name.toLowerCase();
    return this.options!.filter(option => option.name.toLowerCase().indexOf(filterValue) >= 0);
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
