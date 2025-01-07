import { FormControl } from "@angular/forms";

export interface PostForm {
    tweet: FormControl<boolean>;
    post: FormControl<boolean>;
    blueskyPost: FormControl<boolean>;
}
