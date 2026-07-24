# Flix search typeahead (prototype)

Lightweight, prototype-only intelligent search for `flix.cultpodcasts.com`. Adds typeahead/suggestions to `app-search-bar` while typing, sourced from a small **static JSON match index** checked into this repo (no new backend endpoint).

## Corpus

`src/assets/search-suggestions.json` — generated **read-only** from Cosmos DB (RPP repo), containing only:

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

### Preferred: RPP exporter (emits flat index directly)

```powershell
# From the RPP repo root
dotnet run --project Console-Apps/ExportSearchSuggestions -- search-suggestions.json
Copy-Item .\search-suggestions.json .\cultpodcasts\src\assets\search-suggestions.json -Force
# (paths relative to each repo as appropriate)
```

### Legacy nested → flat

If you still have a nested `{ subjects, podcasts }` export:

```powershell
# From website/cultpodcasts
node scripts/flatten-search-suggestions.mjs path\to\nested.json src\assets\search-suggestions.json
```

`flatten-search-suggestions.mjs` is also a no-op when the input is already flat.

## UX

- `SearchSuggestionsService` lazily fetches/caches `entries`, ranks by exact → prefix → substring (alias rows use a slightly lower band than primary-name rows), dedupes by `type+canonical`, capped to 8 results.
- `SearchBarComponent` debounces input (150ms), keyboard-navigable dropdown.
- Labels use `displayCatalogName` (e.g. "Hustler's University" → "Andrew Tate"); navigation always uses `canonical`.
- Podcast → `/podcast/:name`; subject → `/subject/:name`; free text → `/search/:query`.
