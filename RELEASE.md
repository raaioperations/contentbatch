# ContentBatch V1.0 — production validation

Production: https://raaioperations.github.io/contentbatch/
Repository: https://github.com/raaioperations/contentbatch (main)
Validated application commit: 4c57c9b1d1fe80a6ef49ef7dc4423b315adb7985
Hosting: GitHub Pages, main branch root, HTTPS enforced.

## Evidence

- `npm test`: 39 passed, 0 failed.
- `CONTENTBATCH_CHROME=<installed Chromium executable> npm run test:e2e`: 4 passed, 0 failed under local /ContentBatch/ subpath.
- `CONTENTBATCH_CHROME=<installed Chromium executable> npm run test:browser`: 34 checks passed, 0 failed.
- `BASE_URL=https://raaioperations.github.io/contentbatch/ CONTENTBATCH_CHROME=<installed Chromium executable> npm run test:e2e`: 4 passed, 0 failed; includes all 34 historical workflow checks.
- Runtime used: existing Playwright Chromium headless shell 1200. Initial Google Chrome launches timed out before test execution; the installed Chromium runtime passed the local and production gates.
- Production service worker: activated, controlling scope https://raaioperations.github.io/contentbatch/, 29 shell assets verified.
- Isolated production contexts verified capture, editing/autosave, reversible statuses, safe Batch deletion, date stability, search/filters/tags, Template independence, JSON download, non-destructive malformed restore, valid replacement, CSV download, clipboard, offline reload and persistence, and return online.
- Production network observation: 75 requests in the focused release scenario, no unexpected external requests, no content-bearing non-GET requests, no uncaught application errors.
- Responsive workflow checks covered widths 390, 430, 1280 and 1440. Production Data dialog screenshots were inspected at 390x844 and 1280x900.
- No production shell changes were required: cache stays contentbatch-shell-v1. Unit checks cover asset availability and safe obsolete-owned-cache cleanup. No artificial production cache mutation was performed.

## Scope/privacy

Static browser application, no production JavaScript dependencies. No backend, database hosting, authentication, accounts, AI, social integrations, cloud sync, analytics, collaboration, approvals, CRM, advertising, campaigns, payments, external calendars, recurrence, or posting-time optimization. No credentials found in application source. Browser test data lived only in isolated test contexts.

## Manual checks remaining

Physical iOS/Android install and offline launch, native installation prompts, device clipboard behavior, and an actual screen-reader session remain unverified. Commercial validation is separate; $19 lifetime remains a hypothesis.
