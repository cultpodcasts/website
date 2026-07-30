# Flix search typeahead

Lightweight intelligent search for the production Flix UI on `cultpodcasts.com`. Adds typeahead/suggestions to `app-search-bar` while typing, sourced from a **flat JSON match index** published to Cloudflare R2 and served by the API worker (no website redeploy to refresh).

## Corpus

Published to R2 key `search-suggestions` and served as **GET `/search-suggestions`** (public). Contains only:

- **Subjects**: primary `name` + `aliases` — **`associatedSubjects` are intentionally excluded**
- **Podcasts**: `name` only (non-removed podcasts)

Stored as a **flat, pre-normalized match index** (one row per searchable string) so the search box does not re-lowercase nested fields on every keystroke:

```json
{
  "generatedAtUtc": "2026-07-24T13:33:44Z",
  "entries": [
    { "type": "subject", "canonical": "Scientology", "searchText": "scientology" },
    { "type": "subject", "canonical": "Scientology", "searchText": "cos", "alias": "CoS" },
    { "type": "podcast", "canonical": "IndoctriNation", "searchText": "indoctrination" }
  ]
}
```

| Field | Meaning |
|--------|---------|
| `type` | `subject` or `podcast` |
| `canonical` | Name used for navigation/search (never a display-only alias) |
| `searchText` | **Already lowercase** — matched with `===` / `startsWith` / `includes` |
| `alias` | Optional; original casing when this row indexes a subject alias |

No episode data, no writes to Cosmos, no `AssociatedSubjects`.

## How it's produced (targeted, read-only)

### Preferred: publish to R2 (production)

From the RPP repo:

```powershell
dotnet run --project Console-Apps/PublishR2 -- search-suggestions
```

Index is built by `SearchSuggestionsIndexBuilder` and uploaded to the `content` bucket key `search-suggestions`. The Indexer function also refreshes it weekly (Sunday 07:07 UTC via `SearchSuggestionsPublish`).

### Local file export (debugging)

```powershell
dotnet run --project Console-Apps/ExportSearchSuggestions -- search-suggestions.json
```

Uses the same builder; writes a file only (does not update R2).

### Legacy nested → flat

If you still have a nested `{ subjects, podcasts }` export:

```powershell
# From website/cultpodcasts
node scripts/flatten-search-suggestions.mjs path\to\nested.json out\search-suggestions.json
```

`flatten-search-suggestions.mjs` is also a no-op when the input is already flat.

## UX

- `SearchSuggestionsService` lazily fetches/caches `entries` from `environment.api` `/search-suggestions`, ranks by exact → prefix → substring (alias rows use a slightly lower band than primary-name rows), dedupes by `type+canonical`, capped to 8 results.
- `SearchBarComponent` debounces input (150ms), keyboard-navigable dropdown.
- Labels use `displayCatalogName` (e.g. "Hustler's University" → "Andrew Tate"); navigation always uses `canonical`.
- Podcast → `/podcast/:name`; subject → `/subject/:name`; free text → `/search/:query`.
