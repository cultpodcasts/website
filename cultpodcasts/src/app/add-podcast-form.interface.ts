import { FormControl } from "@angular/forms";
import { EditPodcastForm } from "./edit-podcast-form.interface";

export interface AddPodcastForm extends EditPodcastForm {
    podcastName: FormControl<string>;
}
