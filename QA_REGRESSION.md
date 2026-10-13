# Task 7: frontend QA regression

## Scope and prerequisites

Authentication, permissions, inventory workflows, product/batch/user CRUD, async
feedback, accessible confirmations, and desktop/mobile layouts. QA identity:
`shim-zzz <shielaamaee@gmail.com>`. No real account credentials are needed.

Use Node.js 24, npm 11/12, installed frontend dependencies, PHP 8.4, and the Laravel
checkout with Composer development dependencies installed. The Laravel configuration
cache must be absent for the isolated live runner. Stop conflicting test servers on
ports 5197, 5198, and 5199. Neither runner uses the team's database.

Browser checks require an already available Playwright module and Microsoft Edge.
No browser dependency was added to this application's package manifest. If Playwright
is available outside the repository, set `QA_PLAYWRIGHT_MODULE` to its `file:///.../index.mjs`
module URL. Without that override, the runner imports an available `playwright` package.
Obtain approval before installing additional tooling on a teammate's machine.

```powershell
npm ci
# Set QA_PLAYWRIGHT_MODULE if needed for your installed browser tooling.
npm run qa:browser
$env:QA_BACKEND_PATH = 'C:/path/to/wba-sunshine-backend'
npm run qa:live
npm run build
```

In the Laravel checkout, also run `php artisan test --compact`.

`qa:browser` uses deterministic API interception to exercise delayed responses,
failures, keyboard focus, and viewport changes. `qa:live` starts local Laravel/Vite
servers, migrates a disposable SQLite database in the system temporary directory,
and creates factory accounts with a randomly generated password. It exercises real
HTTP requests and persistence. Temporary fixtures remain outside the repository
for diagnosis; servers and browser sessions close after the run. Do not use these
factory accounts for deployment.

## Executed regression checklist

Run date: 2026-10-11, Asia/Singapore. Browser: headless Microsoft Edge.
Viewports: 1440×900 and 390×900. Pass means the stated checks executed successfully;
it does not imply that every browser or device was tested.

| ID | Steps and expected result | Evidence layer | Result |
| --- | --- | --- | --- |
| AUTH-01 | Open a protected hash route without a token; show labeled, masked credential inputs and sign-in. | Live browser | Pass |
| AUTH-02 | Submit invalid credentials, then valid credentials; invalid email gets accessible feedback and only valid login opens the intended inventory route. | Live browser | Pass |
| AUTH-03 | Reload after login and product edit; restore the session and retain the saved record. | Live browser/API | Pass |
| AUTH-04 | Make `/auth/me` return 500, then retry successfully; persist the error and avoid duplicate initial restoration calls. | Intercepted browser | Pass |
| AUTH-05 | Return 401 during restoration; remove the token and return to sign-in. | Intercepted browser | Pass |
| AUTH-06 | Sign out, await the logout response, then call `/auth/me` with the old token; receive 401. | Live browser/API | Pass |
| ROLE-01 | Sales Staff opens Users directly; deny access and hide its navigation entry. | Intercepted browser | Pass |
| ROLE-02 | Purchasing Manager opens Adjustments; allow review-only access and hide own-request review actions. | Intercepted browser | Pass |
| ROLE-03 | For all eight supported department/role combinations, exercise movement types, adjustment requests/reviews, and product/batch create/update/delete; enforce the permission matrix. | Live API | Pass |
| ROLE-04 | Attempt approval and rejection as each role; unauthorized reviewers receive 403. An authorized requester cannot review their own adjustment; receive 422 and preserve Pending status. | Live API and Laravel suite | Pass |
| ROLE-05 | Non-administrators request the user list; receive 403. Offer only supported roles when changing a user's department. | Live API/intercepted browser | Pass |
| CRUD-01 | Create and edit a product in the UI; reload and verify its saved name. | Live browser/API | Pass |
| CRUD-02 | Switch between product edit targets, then Add; populate the correct record and reset new-product fields. | Intercepted browser | Pass |
| CRUD-03 | Create/edit a batch in the UI; verify saved number and stock increase. | Live browser/API | Pass |
| CRUD-04 | Create, edit, and delete a temporary user through the UI; persist department/role changes and refresh the list after each successful write. | Live browser/API | Pass |
| CRUD-05 | Delete an empty batch and clean product; return 204. Delete records with inventory history; return 422. | Live API | Pass |
| FLOW-01 | Submit Stock In, Stock Out, Transfer, and Return through the UI; verify four persisted transactions. | Live browser/API | Pass |
| FLOW-02 | Enter receiving data, then switch across movement routes; clear quantity and reference on each route change. | Intercepted browser | Pass after fix |
| FLOW-03 | Submit Cycle Count; create a pending adjustment requiring another reviewer. | Live browser/API | Pass |
| FLOW-04 | Open Cycle Count with no products; show an empty state without a crash. | Intercepted browser | Pass |
| ASYNC-01 | Delay product creation and submit again while pending; disable inputs and issue only one write. | Intercepted browser | Pass |
| ASYNC-02 | Return 422 with a SKU/email field error; mark the field invalid and link its accessible description. | Intercepted browser | Pass |
| VALID-01 | Submit empty required fields and negative starting stock; native validation blocks submission with no write. Submit an excessive movement quantity directly to Laravel; return 422. | Intercepted browser/live API | Pass |
| ASYNC-03 | Return 403, 404, 500, and connection failure for inventory; show understandable persistent feedback and Retry. | Intercepted browser | Pass |
| ASYNC-04 | Save successfully, fail inventory refresh, then Retry; state that the change was saved and do not repeat the write. | Intercepted browser | Pass |
| DIALOG-01 | Open Delete, cycle Tab/Shift+Tab, Escape-cancel; trap focus and restore it to the initiating button. | Intercepted browser | Pass |
| DIALOG-02 | Confirm with a delayed delete; disable both actions, block Escape dismissal, and send one write. Return an error; keep the dialog open with feedback. | Intercepted browser | Pass |
| MOBILE-01 | Open Inventory, Batches, Stock In, Adjustments, and Users at both widths; prevent page-level horizontal overflow and keep mobile navigation usable. Tables may scroll inside their container. | Intercepted browser | Pass after fix |
| EMPTY-01 | Load empty inventory; show an empty product list and empty Cycle Count. | Live/intercepted browser | Pass |
| ERROR-01 | Run both browser suites; no uncaught browser exceptions. | Browser | Pass |

## Defects found and retested

### QA-001: movement data carries into another transaction type

- Reproduction: open Stock In, select a product, enter quantity 7 and a receiving
  reference, then navigate to Stock Out without submitting.
- Expected: the new transaction starts with empty fields and validation feedback.
- Actual before fix: product, quantity, and reference carried into Stock Out.
- Impact: a user could submit receiving information as an outbound transaction.
- Fix: key movement forms by transaction type so changing routes resets form state.
- Retest: FLOW-02 passed across Stock In, Stock Out, Transfer, and Return.

### QA-002: mobile inventory page extends beyond the viewport

- Reproduction: open populated Inventory at 390×900.
- Expected: the page fits the viewport, with table overflow contained inside its wrapper.
- Actual before fix: content extended to approximately 901px due to intrinsic grid sizing.
- Fix: allow the page grid track, search controls, and table wrapper to shrink.
- Retest: MOBILE-01 passed at both widths for all five core pages.

### QA-003: null supplier value triggers a React form warning

- Reproduction: create a product without a supplier, then edit it.
- Expected: the optional supplier input is empty and remains controlled.
- Actual before fix: React warned about a null input value.
- Fix: normalize null supplier values to an empty string when opening the editor.
- Retest: the live product create/edit/reload flow passed after normalization.

## Sign-off and limits

Task 9 follow-up verification (2026-10-11): unknown and malformed inventory routes
show Page not found and return to Dashboard; the reorder calculator uses API product
defaults and handles empty inventory; Alerts displays API alerts; the Sunshine theme
remains active after explicit CSS layering. The browser regression suite passed,
including desktop/mobile and dialog focus checks. Three inventory-logic tests passed
in both Asia/Manila and America/New_York, covering local midnight, rolling expiry
boundaries, daylight-saving day differences, depleted batches, and absent capacity.
Run these with `node --test scripts/inventoryLogic.test.mjs`. Frontend build passed.

Task 7 authentication/CRUD regression is signed off after the fixes above and passing
final runs. Laravel suite: 30 tests, 133 assertions. Frontend build: passed.
Defect-fix commits: `8f26f02` (forms) and `e809001` (mobile layout), under Lead Dev 2.

Failures were simulated only for deterministic failure/latency cases. Live tests used
the actual Laravel API and a disposable database for persistence and authorization.
Mobile checks emulate viewport size; physical mobile devices, screen-reader behavior,
other browser engines, and deployed HTTPS/CORS environments were not tested.

The reporting source-of-truth issue was resolved on 2026-10-11: reports are
client-calculated from the last successful Laravel inventory API snapshot, as
specified in README.md. Six report tests passed (including expiry boundaries,
variance, saved-reason cycle-count classification, reorder assumptions, empty
snapshots and refreshed values). Browser regression passed all eight report
selections, API-only refresh with changed stock, assumption validation, print
invocation, empty/restricted states, and 1440×900/390×900 layouts. The native print
dialog/PDF output was not visually inspected. Calculation tests are included in CI.
Cycle-count classification uses the existing saved-reason convention; it does not
claim a structured API source field or distinguish manually matching reasons.

Task 9's hardcoded dates, duplicate
presentation code, and unknown-route fallback were resolved and retested above. Backend
stock/batch reconciliation after adjustment approval and expiry enforcement remain
domain follow-ups; this sign-off does not certify those business rules or the full
production website.

## Warehouse integrity follow-up — 2026-10-14

The earlier stock/batch and expiry follow-ups above are now implemented locally.
These results apply to the local warehouse-integrity changes, not the deployed service.

| Check | Verification | Result |
| --- | --- | --- |
| Opening stock and metadata edits | Product opening stock gets a batch/ledger; editing metadata cannot overwrite quantity. | Pass |
| Internal transfers | Source/destination location quantities change; warehouse total stays unchanged; same-location transfer is rejected. | Pass |
| Verified counts | Every batch quantity is required; approval reconciles batch/product totals; intervening movement or metadata changes prevent stale approval. | Pass |
| Uncertain write retries | Repeat movement/count requests reuse an identifier; no duplicate write; changed payload with the same identifier is rejected. | Pass |
| Expiry | Backend rejects expired usable-stock movements and positive batch receipts; today is allowed; depleted expiry alerts are excluded. | Pass |
| Access and sessions | Audit reads follow role permissions; non-reviewers see their own adjustments; the last active admin is protected; expired tokens are rejected. | Pass |
| History and reports | Older records are paginated; reports load full permitted history; inclusive warehouse-date filters and CSV download/escaping pass. | Pass |
| Refresh and mobile navigation | Saved writes can refresh without resubmission; inventory retry remains available; mobile sign-out is reachable. | Pass |
| Production database recovery | No verified external backup or restore rehearsal; Supabase Free dashboard does not provide scheduled backups. | Blocked |
| Hosted PostgreSQL and migration | New migration has not been deployed; PostgreSQL CI and hosted verification remain required. | Blocked |

Final local backend suite: **90 tests, 454 assertions passed**. Calculation suite:
**11 tests passed**. Browser regression and production Vite build passed. The live
runner also passed against real Laravel with a disposable SQLite database,
including persisted CRUD, all movement types, counts, review roles, and logout.
The new warehouse regression tests cover stock-version changes even when the final quantity
returns to its original value, legacy stock allocation, transfer-family expiry
updates, and history snapshot boundaries. Browser failure tests use interception;
they do not prove simultaneous PostgreSQL transaction behavior.

Keep the database backup outside Git and test restoration into a separate database
before deploying the stock-control migration. Existing pending counts from before
the migration require rejection and a fresh submission. Production readiness is
not signed off while recovery and hosted database checks remain blocked.

## Recovery, notifications and planning follow-up — 2026-10-14

These results apply to the recovery, notification and planning source changes;
hosted deployment verification is separate.

| Check | Verification | Result |
| --- | --- | --- |
| Trash recovery | Eligible product/batch/user deletions are recoverable; inventory history rules remain guarded. Restore is audited; a deleted batch requires its parent to be restored first. Staff cannot bypass trash permissions. | Pass |
| Account recovery | Delete revokes tokens; restore keeps the user disabled; login remains rejected until an administrator enables the account. | Pass |
| Notification privacy | New movement notices persist once even after idempotent retries. Failed writes do not notify. Adjustment notices are limited to owners/current reviewers, including after demotion. Users cannot read another account's inbox. | Pass |
| Read state | Mark-one/mark-all are account-scoped; unread counts and read state persist after reload. | Pass |
| Accurate availability | Usable stock excludes expired/unallocated quantities. Transfer signs stay neutral; increasing/decreasing adjustments use recorded balances. Matched counts do not produce discrepancy alerts. | Pass |
| Automatic refresh | Visible workspaces refresh every 30 seconds. Forms and dialogs pause automatic refresh. | Pass |
| Planning history | Verified completed-month totals and seasonal month rules save through Laravel and survive reload; duplicates/current-month totals and invalid classifications are rejected. Missing history has a disclosed fallback. | Pass |
| Perishable stock | Undated receipts and undated positive opening stock are rejected; verified dated receipts work. | Pass |
| Mobile layout | Trash and Notifications fit 320×480, 390×640, 844×390 and 1440×900. Planning editor, batch timeline and stock chart fit 320px. Restore cancellation and pending controls pass; dark mode passes. | Pass |

Backend: **101 tests, 545 assertions passed**. Calculations: **13 tests passed**.
Complete browser regression and live Laravel regression passed with disposable
fixtures. Vite production build passed. Final layout checks do not claim testing on
physical devices or other browser engines. Three new migrations, hosted PostgreSQL
checks, and external backup/restore verification are still required for release.
No Sunny/chatbot code is included in these improvements.
