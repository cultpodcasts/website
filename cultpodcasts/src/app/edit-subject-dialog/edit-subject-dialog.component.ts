import { Component, Inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { SubjectForm } from '../subject-form';
import { SubjectEntity } from '../subject-entity';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';
import { EditSubjectSendComponent } from '../edit-subject-send/edit-subject-send.component';

@Component({
  selector: 'app-edit-subject-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatFormFieldModule
  ],
  templateUrl: './edit-subject-dialog.component.html',
  styleUrl: './edit-subject-dialog.component.sass'
})
export class EditSubjectDialogComponent {
  subjectName: string;
  isLoading: boolean = true;
  isInError: boolean = false;

  form: FormGroup<SubjectForm> | undefined;
  originalSubject: SubjectEntity | undefined;
  subjectId: string | undefined;

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<EditSubjectDialogComponent, any>,
    @Inject(MAT_DIALOG_DATA) public data: { subjectName: string },
    private fb: FormBuilder,
    private dialog: MatDialog,
  ) {
    this.subjectName = data.subjectName;
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
      const episodeEndpoint = new URL(`/subject/${encodeURIComponent(this.subjectName)}`, environment.api).toString();
      this.http.get<SubjectEntity>(episodeEndpoint, { headers: headers })
        .subscribe(
          {
            next: resp => {
              this.subjectId = resp.id;
              this.originalSubject = resp;
              this.form = new FormGroup<SubjectForm>({
                name: new FormControl(resp.name!, { nonNullable: true }),
                aliases: new FormControl(resp.aliases, { nonNullable: false }),
                associatedSubjects: new FormControl(resp.associatedSubjects, { nonNullable: false }),
                subjectType: new FormControl(resp.subjectType, { nonNullable: false }),
                enrichmentHashTags: new FormControl(resp.enrichmentHashTags, { nonNullable: false }),
                hashTag: new FormControl(resp.hashTag, { nonNullable: false }),
                redditFlairTemplateId: new FormControl(resp.redditFlairTemplateId, { nonNullable: false }),
                redditFlairText: new FormControl(resp.redditFlairText, { nonNullable: false }),
              });
              this.isLoading = false;
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
    this.dialogRef.close({ closed: true });
  }

  translateForEntity(x: FormControl<string | undefined | null>): string | undefined {
    if (x.value) return x.value;
    return undefined;
  }

  translateForEntityA(x: FormControl<string[] | undefined | null>): string[] | undefined {
    if (x.value) {
      const valueS: any = x.value;
      if (valueS.push) {
        return x.value;
      } else if (valueS.split) {
        const valueSt: string = valueS;
        return valueSt.split(",");
      }
    };
    return undefined;
  }

  onSubmit() {
    if (this.form?.valid) {
      const update: SubjectEntity = {
        aliases: this.translateForEntityA(this.form!.controls.aliases),
        associatedSubjects: this.translateForEntityA(this.form!.controls.associatedSubjects),
        enrichmentHashTags: this.translateForEntityA(this.form!.controls.enrichmentHashTags),
        hashTag: this.translateForEntity(this.form!.controls.hashTag),
        redditFlairTemplateId: this.translateForEntity(this.form!.controls.redditFlairTemplateId),
        redditFlairText: this.translateForEntity(this.form!.controls.redditFlairText),
        subjectType: this.translateForEntity(this.form!.controls.subjectType)
      };

      var changes = this.getChanges(this.originalSubject!, update);
      if (Object.keys(changes).length == 0) {
        this.dialogRef.close({ noChange: true });
      } else {
        this.send(this.subjectId!, changes);
      }
    }
  }

  isSame(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
    if (!a && !b) {
      return true;
    }
    return JSON.stringify(a) == JSON.stringify(b);
  }

  getChanges(prev: SubjectEntity, now: SubjectEntity): SubjectEntity {
    var changes: SubjectEntity = {};
    if (!this.isSame(prev.aliases, now.aliases)) changes.aliases = now.aliases;
    if (!this.isSame(prev.associatedSubjects, now.associatedSubjects)) changes.associatedSubjects = now.associatedSubjects;
    if (!this.isSame(prev.enrichmentHashTags, now.enrichmentHashTags)) changes.enrichmentHashTags = now.enrichmentHashTags;
    if (prev.hashTag != now.hashTag) changes.hashTag = now.hashTag;
    if (prev.redditFlairTemplateId != now.redditFlairTemplateId) changes.redditFlairTemplateId = now.redditFlairTemplateId;
    if (prev.redditFlairText != now.redditFlairText) changes.redditFlairText = now.redditFlairText;
    if (prev.subjectType != now.subjectType) changes.subjectType = now.subjectType;
    return changes;
  }

  send(id: string, changes: SubjectEntity) {
    return;
    const dialogRef = this.dialog.open(EditSubjectSendComponent);
    dialogRef.componentInstance.submit(id, changes);
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        this.dialogRef.close({ updated: true });
      }
    });
  }
}
