import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, from } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { SearchBoxMode } from '../search-box-mode.enum';
import { Router } from '@angular/router';
import { SiteService } from '../site.service';
import { SearchSuggestionsService } from '../search-suggestions.service';
import { Suggestion } from '../search-suggestions.interface';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { TextFieldModule } from '@angular/cdk/text-field';

const SUGGESTION_DEBOUNCE_MS = 150;

@Component({
  selector: 'app-search-bar',
  imports: [
    MatButtonModule,
    FormsModule,
    MatFormFieldModule,
    MatChipsModule,
    MatInputModule,
    MatIconModule,
    TextFieldModule
  ],
  templateUrl: './search-bar.component.html',
  styleUrl: './search-bar.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class SearchBarComponent {
  protected readonly searchChip = signal<string | null>(null);
  protected readonly searchBoxMode = signal(SearchBoxMode.Default);
  protected readonly suggestions = signal<Suggestion[]>([]);
  protected readonly suggestionsOpen = signal<boolean>(false);
  protected readonly activeSuggestionIndex = signal<number>(-1);

  @ViewChild('searchBox', { static: true })
  searchBox: ElementRef | undefined;

  private readonly queryInput$ = new Subject<string>();

  constructor(
    private router: Router,
    private siteService: SiteService,
    private suggestionsService: SearchSuggestionsService) {
    this.siteService.currentSiteData
      .pipe(takeUntilDestroyed())
      .subscribe(siteData => {
        if (this.searchBox) {
          this.searchBox.nativeElement.value = siteData.query ?? "";
          if (siteData.podcast != null) {
            this.searchChip.set(siteData.podcast);
            this.searchBoxMode.set(SearchBoxMode.Podcast);
          } else if (siteData.subject != null) {
            this.searchChip.set(siteData.subject);
            this.searchBoxMode.set(SearchBoxMode.Subject);
          } else {
            this.searchChip.set(null);
            this.searchBoxMode.set(SearchBoxMode.Default);
          }
        }
      });

    this.queryInput$
      .pipe(
        takeUntilDestroyed(),
        debounceTime(SUGGESTION_DEBOUNCE_MS),
        distinctUntilChanged(),
        switchMap(term => from(this.suggestionsService.suggest(term)))
      )
      .subscribe(results => {
        this.suggestions.set(results);
        this.activeSuggestionIndex.set(-1);
        this.suggestionsOpen.set(results.length > 0);
      });
  }

  onFocus(): void {
    this.suggestionsService.preload();
    if (this.searchBox?.nativeElement.value) {
      this.queryInput$.next(this.searchBox.nativeElement.value);
    }
  }

  onInput(value: string): void {
    this.queryInput$.next(value);
  }

  onBlur(): void {
    setTimeout(() => this.suggestionsOpen.set(false), 100);
  }

  onKeydown(event: KeyboardEvent, input: HTMLInputElement): void {
    const items = this.suggestions();
    switch (event.key) {
      case 'ArrowDown':
        if (this.suggestionsOpen() && items.length > 0) {
          event.preventDefault();
          this.activeSuggestionIndex.set((this.activeSuggestionIndex() + 1) % items.length);
        }
        break;
      case 'ArrowUp':
        if (this.suggestionsOpen() && items.length > 0) {
          event.preventDefault();
          this.activeSuggestionIndex.set(
            (this.activeSuggestionIndex() - 1 + items.length) % items.length
          );
        }
        break;
      case 'Enter': {
        const activeIndex = this.activeSuggestionIndex();
        if (this.suggestionsOpen() && activeIndex >= 0 && activeIndex < items.length) {
          event.preventDefault();
          this.selectSuggestion(items[activeIndex]);
        } else {
          this.suggestionsOpen.set(false);
          this.search(input);
        }
        break;
      }
      case 'Escape':
        if (this.suggestionsOpen()) {
          this.suggestionsOpen.set(false);
          this.activeSuggestionIndex.set(-1);
        }
        break;
    }
  }

  /** Bound via (mousedown) with preventDefault so selecting a suggestion never blurs the input first. */
  selectSuggestion(suggestion: Suggestion): void {
    this.suggestionsOpen.set(false);
    this.activeSuggestionIndex.set(-1);
    if (this.searchBox) {
      this.searchBox.nativeElement.value = '';
    }
    if (suggestion.type === 'podcast') {
      this.router.navigate(['/podcast/' + suggestion.value]);
    } else {
      this.router.navigate(['/subject/' + suggestion.value]);
    }
  }

  search = (input: HTMLInputElement) => {
    input.blur();
    this.suggestionsOpen.set(false);
    const chip = this.searchChip();
    if (chip) {
      if (this.searchBoxMode() == SearchBoxMode.Podcast) {
        this.router.navigate(['/podcast/' + chip + "/" + input.value]);
      } else if (this.searchBoxMode() == SearchBoxMode.Subject) {
        this.router.navigate(['/subject/' + chip + "/" + input.value]);
      }
    } else {
      this.router.navigate(['/search/' + input.value]);
    }
  };

  removeSearchChip() {
    this.searchChip.set(null);
    var query = this.siteService.getSiteData().query;
    if (query && query != "") {
      const url = `/search/` + query;
      this.router.navigate([url]);
    } else {
      const url = `/`;
      this.router.navigate([url]);
    }
  }
}
