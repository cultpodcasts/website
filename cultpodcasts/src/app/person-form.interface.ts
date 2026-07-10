import { FormControl } from '@angular/forms';

export interface PersonForm {
    name: FormControl<string>;
    sortName: FormControl<string | null | undefined>;
    aliases: FormControl<string[] | null | undefined>;
    twitterHandle: FormControl<string | null | undefined>;
    blueskyHandle: FormControl<string | null | undefined>;
}
