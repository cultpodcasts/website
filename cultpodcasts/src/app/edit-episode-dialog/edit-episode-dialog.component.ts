import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';
import { Episode } from '../episode';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { EpisodeForm } from '../episode-form';
import {MatTabsModule} from '@angular/material/tabs'; 

@Component({
  selector: 'app-edit-episode-dialog',
  standalone: true,
  imports: [
    MatDialogModule, 
    MatProgressSpinnerModule, 
    MatButtonModule, 
    ReactiveFormsModule, 
    MatTabsModule],
  templateUrl: './edit-episode-dialog.component.html',
  styleUrl: './edit-episode-dialog.component.sass'
})
export class EditEpisodeDialogComponent {
  episodeId: string;
  isLoading: boolean = true;
  isInError: boolean = false;

  form = new FormGroup<EpisodeForm>({
    title: new FormControl('', { nonNullable: true }),
    description: new FormControl('', { nonNullable: true }),
    posted: new FormControl(false, { nonNullable: true }),
    tweeted: new FormControl(false, { nonNullable: true }),
    ignored: new FormControl(false, { nonNullable: true }),
    explicit: new FormControl(false, { nonNullable: true }),
    removed: new FormControl(false, { nonNullable: true }),
    release: new FormControl(new Date(), { nonNullable: true }),
    duration: new FormControl('', { nonNullable: true }),
    spotify: new FormControl(null, { nonNullable: true }),
    apple: new FormControl(null, { nonNullable: true }),
    youtube: new FormControl(null, { nonNullable: true }),
    subjects: new FormControl([], { nonNullable: true }),
    searchTerms: new FormControl(null, { nonNullable: true }),
  });
  
  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<EditEpisodeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { episodeId: string },
    private fb: FormBuilder
  ) {
    this.episodeId = data.episodeId;
  }

  ngOnInit() {
    var token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));
    token.then(_token => {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + _token);
      const endpoint = new URL(`/episode/${this.episodeId}`, environment.api).toString();
      this.http.get<Episode>(endpoint, { headers: headers })
        .subscribe(
          {
            next: resp => {
              this.isLoading = false;
              console.log(resp)
              this.form.controls.title.setValue(resp.title);
              this.form.controls.description.setValue(resp.description);
              this.form.controls.posted.setValue(resp.posted);
              this.form.controls.tweeted.setValue(resp.tweeted);
              this.form.controls.ignored.setValue(resp.ignored);
              this.form.controls.removed.setValue(resp.removed);
              this.form.controls.explicit.setValue(resp.explicit);
              this.form.controls.release.setValue(resp.release);
              this.form.controls.duration.setValue(resp.duration);
              this.form.controls.spotify.setValue(resp.urls.spotify||null);
              this.form.controls.apple.setValue(resp.urls.apple||null);
              this.form.controls.youtube.setValue(resp.urls.youtube||null);
              this.form.controls.subjects.setValue(resp.subjects);
              this.form.controls.searchTerms.setValue(resp.searchTerms||null);
            },
            error: e => {
              this.isLoading = false;
              this.isInError = true;
            }
          }
        )
    }).catch(x => {
      this.isLoading = false;
      this.isInError = true;
    });
  }

  close() {
    this.dialogRef.close();
  }
}
