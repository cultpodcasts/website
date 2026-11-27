import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { KeyValuePipe } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatSelectModule } from "@angular/material/select";
import { TextFieldModule } from "@angular/cdk/text-field";
import { CatalogueParentEditor } from "../catalogue-parent-editor";
import {
  CatalogueParentEditModel,
  historyDateText,
  includeTitleRegexBlocksIndexAllEpisodes,
  releaseAuthorityOptions
} from "../catalogue-parent-edit";
import { PlaylistIdHistoryEntry } from "../catalogue-parent.interface";
import { YouTubeIndexingHints } from "../youtube-indexing-hints.interface";
import { formatIndexingHintInstant } from "../youtube-indexing-hints.util";
import { youTubeChannelIgnoredHint, youTubePlaylistReplacesChannel } from "../podcast-form.util";

export type CatalogueParentFieldPart = "details" | "flags" | "subjects" | "social" | "meta" | "regexs";

/**
 * One shared tab body for the TV-show and news-organisation edit dialogs.
 * `mat-tab` stays in the dialog so news can project additional YouTube channels
 * into Details and TV can keep its own Identity tab.
 */
@Component({
  selector: "app-catalogue-parent-fields",
  imports: [
    FormsModule,
    KeyValuePipe,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
    TextFieldModule
  ],
  templateUrl: "./catalogue-parent-fields.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatalogueParentFieldsComponent {
  readonly part = input.required<CatalogueParentFieldPart>();
  readonly model = input.required<CatalogueParentEditModel>();
  readonly editor = input<CatalogueParentEditor | null>(null);
  readonly label = input("");
  readonly playlistHistory = input<PlaylistIdHistoryEntry[]>([]);
  readonly indexingHints = input<YouTubeIndexingHints | null>(null);
  readonly clearingIndexingHints = input(false);
  readonly appleIdInvalid = input(false);
  readonly publicationDelayInvalid = input(false);
  readonly minimumDurationInvalid = input(false);

  readonly appleIdEdited = output<void>();
  readonly publicationDelayEdited = output<void>();
  readonly minimumDurationEdited = output<void>();
  readonly forceFullWalk = output<void>();

  protected readonly releaseAuthorityOptions = releaseAuthorityOptions;
  protected readonly historyDateText = historyDateText;
  protected readonly formatHintInstant = formatIndexingHintInstant;
  protected readonly youTubePlaylistReplacesChannel = youTubePlaylistReplacesChannel;
  protected readonly youTubeChannelIgnoredHint = youTubeChannelIgnoredHint;
  protected readonly includeTitleRegexBlocksIndexAllEpisodes = includeTitleRegexBlocksIndexAllEpisodes;
}
