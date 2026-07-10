import { FormControl } from '@angular/forms';

export interface PersonForm {
    name: FormControl<string>;
    aliases: FormControl<string[] | null | undefined>;
    twitterHandle: FormControl<string | null | undefined>;
    blueskyHandle: FormControl<string | null | undefined>;
}
