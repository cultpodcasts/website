import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';

@Component({
  selector: 'app-add-term',
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    FormsModule
  ],
  templateUrl: './add-term.component.html',
  styleUrl: './add-term.component.sass'
})
export class AddTermComponent {
  isSending: boolean = false;
  isInError: boolean = false;
  term: any;
  conflict: boolean = false;
  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<AddTermComponent, any>
  ) { }

  ngOnInit() {
  }

  close() {
    this.dialogRef.close({ closed: true });
  }

  async onSubmit() {
    let headers: HttpHeaders = new HttpHeaders();

    let token: string | undefined;
    this.isSending = true;
    try {
      token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
        authorizationParams: {
          audience: `https://api.cultpodcasts.com/`,
          scope: 'admin'
        }
      }));
    } catch (e) {
      console.error(e);
    }
    try {
      if (token) {
        headers = headers.set("Authorization", "Bearer " + token);

        const resp = await firstValueFrom<HttpResponse<any>>(this.http.post(new URL("/terms", environment.api).toString(), { term: this.term }, { headers: headers, observe: 'response' }));
        if (resp.status == 200) {
          this.isSending = false;
          this.conflict = false;
          this.dialogRef.close({ updated: true, term: this.term });
        } else {
          console.error(resp);
          this.isInError = true;
          this.isSending = false;
          this.conflict = false;
        }
      }
    } catch (error: any) {
      console.error(error);
      if (error.status == 409) {
        this.conflict = true;
      }
      this.isSending = false;
      this.isInError = true;
    }
  }
}
