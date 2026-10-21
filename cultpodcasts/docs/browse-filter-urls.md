# Browse filter URLs and history

Filter chips on the subject, search, podcast and series-hub (TV show / news
organisation) pages live in the URL fragment, e.g. `/subject/Topic#show=Show%20A&lang=sw,ki`,
so a filtered view can be bookmarked and shared. Helpers live in
`src/app/browse-filter-params.ts`.

## Rules

1. **BFU-001: user filter changes push.** Each chip click, show/subject/kind
   toggle, language change and Clear filters that changes the state adds one
   browser history entry (`writeUrlFragment(..., 'push')`).
2. **BFU-002: no duplicates.** A click that leaves the state unchanged writes
   nothing (pages compare against the fragment they last read or wrote).
3. **BFU-003: restoring and tidying replace.** Initial load, dropping unknown
   or malformed values from a bookmarked fragment, and reconciling chips after
   facets load (e.g. widening languages to All) use `'replace'`, so Back from
   the first state leaves the page.
4. **BFU-004: Back/Forward restore.** A fragment change on the same path and
   query that the page did not write (browser Back/Forward) re-reads the chips
   from the fragment and reloads the results, exactly as on first load. A
   missing `lang` means the untouched English default, so the next language
   click again starts from just that language.
5. **BFU-005: no scroll, no reload.** Fragment writes use `scroll: 'manual'`
   and stay in the same document; the router never treats them as a new page.
6. **BFU-006: clearing to no fragment still pushes.** Angular's router replaces
   when the new URL equals the current one minus its hash, so a push that
   removes the fragment duplicates the current entry first and the router
   replaces the copy.

Tests: `browse-filter-params.spec.ts`, the four component specs, and
`e2e/browse-filter-fragment.spec.ts` (catalogue Playwright config).
