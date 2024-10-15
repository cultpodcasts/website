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
import { Flair } from '../flair';
import { MatSelectModule } from '@angular/material/select';
import { KeyValue, KeyValuePipe, NgFor } from '@angular/common';

@Component({
  selector: 'app-edit-subject-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatFormFieldModule,
    MatSelectModule,
    NgFor,
    KeyValuePipe
  ],
  templateUrl: './edit-subject-dialog.component.html',
  styleUrl: './edit-subject-dialog.component.sass'
})
export class EditSubjectDialogComponent {
  subjectName: string | undefined;
  isLoading: boolean = true;
  isInError: boolean = false;

  form: FormGroup<SubjectForm> | undefined;
  originalSubject: SubjectEntity | undefined;
  subjectId: string | undefined;
  create: boolean;
  conflict: string | undefined;
  flairs: Map<string, Flair> = new Map<string, Flair>();

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<EditSubjectDialogComponent, any>,
    @Inject(MAT_DIALOG_DATA) public data: { subjectName: string | undefined, create: boolean | undefined },
    private fb: FormBuilder,
    private dialog: MatDialog,
  ) {
    this.subjectName = data.subjectName;
    this.create = data.create || false;
  }

  ngOnInit() {
    this.isLoading = true;
    var token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));
    token.then(_token => {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + _token);
      const flairsEndpoint = new URL("/flairs", environment.api).toString();
      this.http.get<Map<string, Flair>>(flairsEndpoint, { headers: headers })
        .subscribe({
          next: flairs => {
            this.flairs = flairs;
            if (!this.create) {
              const episodeEndpoint = new URL(`/subject/${encodeURIComponent(this.subjectName!)}`, environment.api).toString();
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
                        redditFlareText: new FormControl(resp.redditFlareText, { nonNullable: false }),
                      });
                      this.isLoading = false;
                    },
                    error: e => {
                      this.isLoading = false;
                      this.isInError = true;
                    }
                  }
                )
            } else {
              this.originalSubject = {};
              this.form = new FormGroup<SubjectForm>({
                name: new FormControl(""!, { nonNullable: true }),
                aliases: new FormControl([], { nonNullable: false }),
                associatedSubjects: new FormControl([], { nonNullable: false }),
                subjectType: new FormControl("", { nonNullable: false }),
                enrichmentHashTags: new FormControl([], { nonNullable: false }),
                hashTag: new FormControl("", { nonNullable: false }),
                redditFlairTemplateId: new FormControl("", { nonNullable: false }),
                redditFlareText: new FormControl("", { nonNullable: false }),
              });
              this.isLoading = false;
            }
          },
          error: error => {
            this.isLoading = false;
            this.isInError = true;
          }
        })
    }).catch(x => {
      this.isLoading = false;
      this.isInError = true;
    });
  }

  close() {
    if (this.conflict) {
      this.dialogRef.close({ conflict: this.conflict });

    } else {
      this.dialogRef.close({ closed: true });
    }
  }

  translateForEntity(x: FormControl<string | undefined | null>): string | undefined {
    if (x.value) return x.value;
    return "";
  }

  translateForEntityG(x: FormControl<string | undefined | null>): string | undefined {
    if (x.value) return x.value;
    return "00000000-0000-0000-0000-000000000000";
  }

  translateForEntityE(x: FormControl<string | undefined | null>): string | undefined {
    if (x.value) return x.value;
    return "Unset";
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
    return [];
  }

  onSubmit() {
    if (this.form?.valid) {
      const update: SubjectEntity = {
        aliases: this.translateForEntityA(this.form!.controls.aliases),
        associatedSubjects: this.translateForEntityA(this.form!.controls.associatedSubjects),
        enrichmentHashTags: this.translateForEntityA(this.form!.controls.enrichmentHashTags),
        hashTag: this.translateForEntity(this.form!.controls.hashTag),
        redditFlairTemplateId: this.translateForEntityG(this.form!.controls.redditFlairTemplateId),
        redditFlareText: this.translateForEntity(this.form!.controls.redditFlareText),
        subjectType: this.translateForEntityE(this.form!.controls.subjectType)
      };

      if (this.create) {
        update.name = this.translateForEntity(this.form!.controls.name);
      }

      var changes = this.getChanges(this.originalSubject!, update);
      if (Object.keys(changes).length == 0) {
        this.dialogRef.close({ noChange: true });
      } else {
        this.send(this.subjectId!, changes);
      }
    }
  }

  isSameA(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
    if (!a && !b) {
      return true;
    }
    if (!a && b?.length == 0) {
      return true;
    }
    if (a?.length == 0 && !b) {
      return true;
    }
    return JSON.stringify(a) == JSON.stringify(b);
  }

  isSame(a: string | null | undefined, b: string | null | undefined): boolean {
    if (!a && !b) {
      return true;
    }
    return JSON.stringify(a) == JSON.stringify(b);
  }

  getChanges(prev: SubjectEntity, now: SubjectEntity): SubjectEntity {
    var changes: SubjectEntity = {};
    if (this.create) changes.name = now.name;
    if (!this.isSameA(prev.aliases, now.aliases)) changes.aliases = now.aliases;
    if (!this.isSameA(prev.associatedSubjects, now.associatedSubjects)) changes.associatedSubjects = now.associatedSubjects;
    if (!this.isSameA(prev.enrichmentHashTags, now.enrichmentHashTags)) changes.enrichmentHashTags = now.enrichmentHashTags;
    if (!this.isSame(prev.hashTag, now.hashTag)) changes.hashTag = now.hashTag;
    if (!this.isSame(prev.redditFlairTemplateId, now.redditFlairTemplateId)) changes.redditFlairTemplateId = now.redditFlairTemplateId;
    if (!this.isSame(prev.redditFlareText, now.redditFlareText)) changes.redditFlareText = now.redditFlareText;
    if (!this.isSame(prev.subjectType, now.subjectType)) changes.subjectType = now.subjectType;
    return changes;
  }

  send(id: string, changes: SubjectEntity) {
    const dialogRef = this.dialog.open(EditSubjectSendComponent, { disableClose: true, autoFocus: true, data: { create: this.create } });
    dialogRef.componentInstance.submit(id, changes, this.create);
    dialogRef.afterClosed().subscribe(async result => {
      console.log(result)
      if (result.updated) {
        this.dialogRef.close({ updated: true, subjectName: changes.name });
      } else if (result.conflict) {
        this.conflict = result.conflict;
      }
    });
  }

  styleOption(flair: Flair): string {
    return `background-color: ${flair.backgroundColour}; color:${flair.textColour == 'dark' ? 'black' : 'white'}`;
  }

  styleSelect(): string {
    const currentFlairId = this.form!.controls.redditFlairTemplateId.value;
    if (currentFlairId) {
      const anyFlair: any = this.flairs;
      const flair = anyFlair[currentFlairId];
      if (flair) {
        return `background-color: ${flair.backgroundColour}; color:${flair.textColour == 'dark' ? 'black' : 'white'}`;
      }
    }
    return "";
  }

}
