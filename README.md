# Sunshine Inventory Frontend

React and Vite frontend for the Sunshine inventory management system. It connects to the Laravel API for authenticated inventory operations, adjustments, audit history, and role-protected management workflows.

## Requirements

- Node.js 24.x (also specified in `.nvmrc` and `package.json`)
- npm 11 or 12
- Running Sunshine Laravel API

## Local setup

```bash
npm ci
copy .env.example .env
npm run dev
```

Open the local Vite URL printed by the command.

## Environment configuration

Set the Laravel API URL in `.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
VITE_API_TIMEOUT_MS=15000
```

`VITE_*` values are public browser configuration. Do not put passwords, API tokens, private keys, or other secrets in them. For deployment, use the public HTTPS address of the deployed Laravel API.

## Available workflows

- Credential sign-in, session restore, and logout
- Inventory, batch, movement, adjustment, alert, and audit views
- Stock In, Stock Out, internal location Transfer, and inspected resaleable Return workflows
- Per-batch physical counts with approval and stale-count protection
- Adjustment review by authorized users other than the requester
- Role-protected product and batch CRUD
- Administration Manager-only user-management CRUD

## Build and verification

```bash
npm ci
npm run build
npm run preview
```

The production files are created in `dist/`. Preview serves the built files locally.
The build validates `VITE_API_BASE_URL` from the environment or Vite environment files.
Vite embeds this URL at build time; changing it requires a new build.
For a Render Free backend, set `VITE_API_TIMEOUT_MS=90000` in Vercel to accommodate
backend cold starts. Allowed range: 1000–120000 milliseconds; no write is
automatically retried. Use the backend's `DEPLOYMENT.md` for the Supabase/Render steps.

The `Frontend build` GitHub Actions workflow runs on pull requests, pushes to `main`,
and manual dispatch. It installs locked dependencies with `npm ci`, builds, and checks
that `dist/index.html` exists. It uses a nonfunctional API URL solely to verify compilation;
it does not contact Laravel or deploy those assets. Runtime API checks belong to QA.
Direct dependencies are pinned to the versions in the committed lockfile. Update
`package.json` and `package-lock.json` together when intentionally updating dependencies.

## Deployment to Vercel

1. Import this frontend repository in Vercel with the repository root as the project root.
2. Select Node.js 24.x and the Vite framework preset. `vercel.json` specifies
   `npm ci`, `npm run build`, and the `dist` output directory.
3. Configure `VITE_API_BASE_URL` in Vercel for both Preview and Production environments.
   Use the actual public HTTPS Laravel API base URL ending in `/api`. Do not use localhost.
4. Use `main` as the production branch. With Vercel's Git integration enabled,
   pull requests receive preview deployments and changes on `main` receive production deployments.
5. Require the `Frontend build / build` status check in GitHub branch protection before
   merging. Vercel builds separately; it does not automatically wait for this CI check.
6. Redeploy after changing environment values. Confirm login, inventory loading,
   CRUD, adjustment review, session restoration, and logout against the deployed backend.

The Laravel API must already be deployed with HTTPS and a migrated database. Configure
its CORS allow-list for the actual frontend production and approved preview origins.
Authentication uses Sanctum bearer tokens supplied by the sign-in workflow.
Hash routes (`#/inventory`) do not require a SPA rewrite.

If deployment fails, check the Node version, install/build logs, and API URL configuration.
If the page loads but API requests fail, check backend availability, HTTPS, and CORS.
Never store passwords, tokens, or private keys in `VITE_*` variables or this repository.
Repository configuration does not create or connect a Vercel project automatically.

References: [GitHub Node build guidance](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs),
[Vercel build configuration](https://vercel.com/docs/builds/configure-a-build).

## Reporting source of truth

Reports are **client-calculated reports based on API-provided data**. Laravel's
persisted records, returned by `GET /api/v1/inventory`, are the authoritative data
source, with older movement and adjustment pages read through
`GET /api/v1/inventory/history/{section}`. React uses the last successfully loaded
snapshot to filter and calculate report rows; there are no report-generation API
endpoints or mock report records. Historical reports load all permitted history
pages before print or CSV export is enabled; failures offer Retry.
`src/utils/reports.js` defines the transformations used by the Reports page and print
view. Refresh report data reloads the API snapshot through the shared inventory
loader; failures use its persistent error/Retry flow. Reports are snapshots, not
real-time accounting or independently stored backend reports.

| Report | Rule |
| --- | --- |
| Inventory Summary | Saved product stock/reorder points, with calculated stock status. |
| Stock Movement | API movement records, type, quantity, reference, timestamp, recorded stock before/after, and storage locations. Legacy missing balances are shown as not recorded. |
| Low Stock | Stock ≤ saved reorder point; shortfall = max(0, reorder point − stock). |
| Expiring Stock | Quantity > 0 and expiry between today and 30 days ahead, inclusive, using the API warehouse timezone (default Asia/Manila). Excludes expired/depleted/undated batches. |
| Inventory Discrepancy | Adjustment requested quantity differs from stock recorded at submission, across all statuses. Variance = requested − recorded quantity. |
| Cycle Count | Adjustments whose reason matches `Cycle count: system N, counted N`, including matched counts. This is the current UI convention; the API has no structured count-source field, so manual reasons matching it are also included. |
| Adjustment | All API adjustment records, across Pending/Approved/Rejected statuses. |
| Seasonal Reorder | Saved monthly sales ÷ 30 × explicit demand multiplier × saved lead time, plus safety stock. Safety stock = daily demand × lead time × safety percent ÷ 100. Round the resulting reorder point up; shortfall = max(0, result − stock). |

Movement, discrepancy, cycle-count, and adjustment reports accept inclusive date
ranges in the warehouse timezone. Stock reports describe the current snapshot;
they do not reconstruct historical stock. CSV export quotes values and neutralizes
spreadsheet formulas. The layout shows the snapshot refresh time and offers an
explicit inventory refresh. Movement/count retries retain their request UUID after
uncertain failures to prevent duplicate writes; other uncertain CRUD results should
be verified by refreshing before resubmission.

Seasonal assumptions default to demand multiplier 1 and safety 15%, are editable
from 0–100, and are shown in the report/print view. Recommendations never update
saved stock or reorder points. Run `node --test scripts/reports.test.mjs` to verify
report rules. Permissions remain those of the existing Reports route.

## QA regression

See [QA_REGRESSION.md](QA_REGRESSION.md) for the executed checklist, defect retests,
tooling prerequisites, and verification limits. `npm run qa:browser` checks deterministic
browser states; `npm run qa:live` checks real Laravel persistence using a disposable
database. These are local QA workflows and are separate from the CI compilation check.

## Team

- Project Manager & Scrum Master, Analysis, Compilation: Sy, John Howell J.
- Lead Developers, Database, ERD, Data Models: Suan, Christopher B.; Vasquez, Aljrome A.
- DevOps / Architecture, DFD, Business Rules: Vecina, Aryana C.; Zarate, Christopher M.
- QA, Validation, Testing Scenarios: Tinasas, Shiela Mae C.
