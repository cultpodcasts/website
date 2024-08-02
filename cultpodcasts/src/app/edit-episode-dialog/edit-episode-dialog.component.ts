import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';
import { Episode } from '../episode';

@Component({
  selector: 'app-edit-episode-dialog',
  standalone: true,
  imports: [],
  templateUrl: './edit-episode-dialog.component.html',
  styleUrl: './edit-episode-dialog.component.sass'
})
export class EditEpisodeDialogComponent {
  episodeId: string;
  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<EditEpisodeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { episodeId: string }) {
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
      const endpoint = new URL("/episode/"+this.episodeId, environment.api).toString();
      this.http.get<Episode>(endpoint, { headers: headers })
        .subscribe(
          {
            next: resp => {
              console.log(resp)

            },
            error: e => {
            }
          }
        )
    }).catch(x => {
    });
  }
}
