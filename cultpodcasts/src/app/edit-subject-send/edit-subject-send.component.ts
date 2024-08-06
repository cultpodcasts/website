import { Component } from '@angular/core';
import { SubjectEntity } from '../subject-entity';

@Component({
  selector: 'app-edit-subject-send',
  standalone: true,
  imports: [],
  templateUrl: './edit-subject-send.component.html',
  styleUrl: './edit-subject-send.component.sass'
})
export class EditSubjectSendComponent {
  public submit(podcastId: string, changes: SubjectEntity) { }

}
