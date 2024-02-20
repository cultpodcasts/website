import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { UrlValidator } from '../url-validator';

@Component({
  selector: 'app-submit-podcast',
  templateUrl: './submit-podcast.component.html',
  styleUrls: ['./submit-podcast.component.sass']
})
export class SubmitPodcastComponent  implements OnInit {

  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<SubmitPodcastComponent>,
    @Inject(MAT_DIALOG_DATA) data : any) {
  }
  
  ngOnInit() {
    this.form = this.fb.group({
      url: [null, [
        Validators.required,
         UrlValidator.isValid()
      ]]
    });
  }
  
  save() {
    console.log(this.form)
    if (this.form.valid) {
      this.dialogRef.close(this.form.value);
    }
  }
  
  close() {
    this.dialogRef.close();
  }
}
