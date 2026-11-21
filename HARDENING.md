# Milestone 4 validation notes

Run `npm test` for domain tests, `npm run test:e2e` for Playwright Test in local Google Chrome, and `npm run test:browser` for the retained Chromium/CDP checks. Tests use isolated browser profiles/contexts and a separate local origin.

Backups are schema 1 JSON. Restore validates all records and relationships before a single readwrite transaction clears and rewrites contentItems, batches, templates and settings. Transaction failure aborts all changes. Imports are limited to 25 MiB and individual string fields to 2 million characters. Unknown record keys are discarded by explicit field construction. CSV cells with spreadsheet formula prefixes receive a leading apostrophe.

The service worker precaches the complete static shell under contentbatch-shell-v1. Increment the cache suffix whenever shell assets change for a release. Activation deletes only obsolete contentbatch-shell-* caches. No user content is cached by the service worker. Data remains in IndexedDB.

Persistent storage is requested only by the explicit Protect Local Data action. Unsupported APIs, denial and API failure remain usable states. Persistence does not replace portable backups.

Physical iOS/Android installation, OS install prompts, physical clipboard behavior and a real screen-reader spot check remain manual production checks. Native confirmation dialogs use browser keyboard/focus behavior.
