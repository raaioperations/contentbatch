# ContentBatch V1.0

A static local content preparation PWA. Commercial demand and the proposed $19 lifetime price remain hypotheses.

## Run and test

- `npm ci` installs development tools only.
- `npm start` serves http://localhost:8000.
- `npm test` runs domain tests.
- `npm run test:e2e` runs Playwright against a local subpath with installed Google Chrome.
- `npm run test:browser` runs the retained Chromium/CDP workflow.
- `BASE_URL=https://raaioperations.github.io/contentbatch/ npm run test:e2e` runs the same suite against production.
- Set `CONTENTBATCH_CHROME` to another installed Chrome executable when needed.

## Deploy

Repository: https://github.com/raaioperations/contentbatch
Production: https://raaioperations.github.io/contentbatch/

GitHub Pages serves the root of `main` over HTTPS; `.nojekyll` preserves static files. No build or application server is required. Run local gates before pushing the release commit. Confirm Pages deployment and run production E2E checks afterward. To roll back, revert the faulty commit and publish a fresh shell cache version; do not rewrite history.

App assets and manifest URLs are relative to the application directory. Service-worker scope stays within that directory. Increment `contentbatch-shell-*` in service-worker.js only when shell assets change. Old owned caches are removed on activation; unrelated cache names are preserved.

## Data and recovery

Content, Batches, Templates and Settings live in IndexedDB on the current browser/device. Clearing site data may remove them. Data / Backup exports full JSON or metadata CSV. Restore validates a backup and then replaces all four stores atomically after confirmation. Keep portable backups. Persistent-storage protection does not replace backups.

After one successful online load and service-worker installation, the cached shell supports offline use; user records remain in IndexedDB. There is no backend, hosted database, authentication, AI API, social API, analytics, or cloud sync.

## Remaining manual checks

Physical iPhone/Android installation and offline launch, native install prompts, physical-device clipboard behavior, and a real screen-reader spot check remain manual checks. See HARDENING.md for import limits and implementation details.
