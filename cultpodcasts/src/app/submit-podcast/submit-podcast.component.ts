import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { UrlValidator } from '../url-validator';
import { PodcastsService } from '../podcasts.service';
import { ISimplePodcast } from '../ISimplePodcast';
import { Observable, map, startWith } from 'rxjs';



@Component({
  selector: 'app-submit-podcast',
  templateUrl: './submit-podcast.component.html',
  styleUrls: ['./submit-podcast.component.sass']  
})
export class SubmitPodcastComponent implements OnInit {

  form!: FormGroup;
  advancedOpenState: boolean = false;
  myControl = new FormControl('');
  filteredOptions!: Observable<ISimplePodcast[]>;
  options: ISimplePodcast[] | undefined;
  showAdvanced: boolean = false;


  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<SubmitPodcastComponent>,
    @Inject(MAT_DIALOG_DATA) data: any,
    private podcastService: PodcastsService) {
  }

  ngOnInit() {
    this.form = this.fb.group({
      url: [null, [
        Validators.required,
        UrlValidator.isValid()
      ]]
    });
    this.filteredOptions = this.myControl.valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value || '')),
    );
    this.podcastService.getPodcasts().then(podcastsResult => {
      if (podcastsResult.results) {
        this.options = podcastsResult.results;
      } else {
        this.showAdvanced = false;
      }
    })
  }

  save() {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value);
    }
  }

  close() {
    this.dialogRef.close();
  }


  private _filter(value: string): ISimplePodcast[] {
    const filterValue = value.toLowerCase();

    return this.options!.filter(option => option.name.toLowerCase().includes(filterValue));
  }
}
