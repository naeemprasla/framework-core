# Large-Scale Modular Framework Core v0.6.4

A dashboard-first modular Node.js/Express framework with PostgreSQL as the only required infrastructure dependency. Applications can run in **full-stack**, **headless**, or **hybrid** delivery modes. Redis is optional and can be configured later from the Admin Console.

## First-run flow

`Server Type → PostgreSQL → Application Info → Super Admin → Login → Dashboard`

The installer asks whether the deployment is local or live, adjusts HTTPS/database-SSL expectations, verifies PostgreSQL, runs Core migrations, creates the first application, creates the Framework Super Admin, permanently locks setup, and redirects to `/admin` for credential login. MFA is configured later from `Security` and is enforced on future logins once enrolled.

## Dashboard-first configuration

Normal runtime configuration is managed through the protected Admin Console rather than source/config-file edits:

- applications and delivery mode;
- API enablement and per-application CORS origins;
- application module enablement;
- schema-driven custom-module settings;
- theme selection;
- API/service credentials;
- optional Redis configuration;
- encrypted provider/runtime settings;
- MFA enrollment, audit and operations.

Deployment-level process controls such as OS/container port binding may still be supplied by the hosting environment.

## Headless + custom modules

Headless clients identify the application with `X-Application-ID`. The Core resolves application context, API availability and per-app CORS. Dashboard-created service credentials use the `fwa_` prefix and are stored hashed. Official modules and trusted developer-authored custom modules use the same Module Runtime and scoped SDK.

Place trusted local custom modules under `custom-modules/<module>/module.manifest.json`. Core discovers them at boot. The Super Admin then enables and configures each module per application from the dashboard. Custom server-side JavaScript is trusted deployment code; do not place untrusted packages in-process.

## Required infrastructure

- Node.js 22+
- PostgreSQL

Optional scaling infrastructure:

- Redis
- object storage/provider integrations
- external event/search/realtime infrastructure as applications grow

## Verification

Run:

```bash
npm run check
npm run check:imports
npm test
npm run test:e2e
```


## v0.6.4 setup update

The initial database step now treats **Supabase Direct Database** as the recommended provider. Paste the direct Postgres connection string from Supabase Dashboard → Connect. Direct mode requires the `db.<project-ref>.supabase.co:5432` endpoint and SSL; Supavisor/pooler URLs are rejected in this installer mode. Generic PostgreSQL remains available as an advanced alternative.

The first-run UI has also been redesigned as a responsive four-step wizard: Server → Database → Application → Super Admin.

## v0.6.4 final-audit changes

- Fresh local development installs automatically open the one-time `/setup/?token=...` URL in the default browser. Auto-open is disabled for production, CI/test, and non-loopback URLs; set `AUTO_OPEN_SETUP=false` to disable it locally.
- Setup links use the canonical trailing-slash URL and preserve token query parameters during redirects.
- Framework version is centralized in `src/core/version.js` to prevent package/runtime version drift.
- Super Admin full name is persisted in `identity.framework_admin_profiles`.
- Initial application creation is retry-safe during interrupted setup and is recorded in framework state.
- Module routes require a resolved `X-Application-ID` and per-application module enablement.
- Admin Console routing has one canonical static/router mount rather than duplicate asset handlers.
- Detailed audit and verification reports are under `docs/`.
