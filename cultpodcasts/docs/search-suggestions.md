# Flix search typeahead (prototype)

Lightweight, prototype-only intelligent search for `flix.cultpodcasts.com`. Adds typeahead/suggestions to `app-search-bar` while typing, sourced from a small **static JSON corpus** checked into this repo (no new backend endpoint).

## Corpus

`src/assets/search-suggestions.json` — generated **read-only** from Cosmos DB (RPP repo), containing only:

- **Subjects**: primary `name` + `aliases` — **`associatedSubjects` are intentionally excluded** (they're a weaker "related term" match channel used for episode categorisation, not identity synonyms suitable for suggesting as the subject itself — see `Subject.AssociatedSubjects` / `SubjectTermType.AssociatedSubject` in RPP).
- **Podcasts**: `name` only (non-removed podcasts).

Shape:

```json
{
  "generatedAtUtc": "2026-07-24T11:59:13Z",
  "subjects": [ { "name": "Scientology", "aliases": ["CoS", "Church of Scientology"] } ],
  "podcasts": [ "Some Podcast Name" ]
}
```

No episode data, no writes to Cosmos, no `AssociatedSubjects`.

## How it's produced (targeted, read-only)

A small console app in the RPP repo, `Console-Apps/ExportSearchSuggestions`, reads **only** the `Subjects` and `Podcasts` Cosmos containers via the existing repository `GetAll()` abstractions and immediately projects each document down to just `name`/`aliases` (subjects) or `name` (podcasts) in memory — nothing else is persisted to disk. It is a distinct, narrower tool from `CosmosDbDownloader` (which dumps every container, including Episodes, to individual per-document files) and was written specifically so this feature never needs to run that full-catalog dump.

```powershell
# From the RPP repo root
dotnet run --project Console-Apps/ExportSearchSuggestions -- search-suggestions.json
```

Then copy the output into this repo and commit:

```powershell
Copy-Item <path-to-RPP>\search-suggestions.json .\cultpodcasts\src\assets\search-suggestions.json -Force
```

## Refreshing later

Re-run the two commands above whenever subjects/aliases/podcast names change meaningfully. There's no scheduled job — this is a manual, occasional refresh for a prototype. If flix graduates beyond prototype, consider promoting this to a scheduled publish (mirroring `HomepagePublisher`) or a small Cosmos-backed GET endpoint instead of a committed static file.

## UX

- `SearchSuggestionsService` (`src/app/search-suggestions.service.ts`) lazily fetches and caches the corpus, then ranks matches for a query (exact > name/alias prefix > substring), capped to 8 results.
- `SearchBarComponent` debounces input (150ms), shows a dropdown listbox with keyboard nav (Up/Down/Enter/Escape) and mouse selection.
- Display uses `displayCatalogName` (e.g. "Hustler's University" → "Andrew Tate") for the visible label, but navigation always uses the canonical name.
- Selecting a **podcast** suggestion navigates to `/podcast/:podcastName`; a **subject** suggestion navigates to `/subject/:subjectName`. Free text (Enter/Search button with no suggestion highlighted) keeps the existing `/search/:query` behaviour.
