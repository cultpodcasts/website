import { FormControl } from "@angular/forms";
import { EditPodcastForm } from "./EditPodcastForm";

export interface AddPodcastForm extends EditPodcastForm {
    podcastName: FormControl<string>;
}
