# Final Code Audit — v0.6.3

## Scope

The final audit covered the startup/installer lifecycle, setup-token handling, Supabase Direct and PostgreSQL configuration, encrypted runtime config, migrations, framework state, initial application/admin creation, authentication/session/MFA flows, Admin Console routing/assets, application/headless context, API credentials, per-app module enablement, custom module discovery/runtime boundaries, module settings/secrets, optional Redis, jobs/outbox/health, storage/template safety, documentation layout, syntax/import integrity, and packaged-release verification.

## Findings corrected in v0.6.3

1. Framework version drift: package version and runtime bootstrap used different v0.6.x values. A single `src/core/version.js` source is now used.
2. Super Admin full name was collected by Setup UI but not persisted. It is now stored in `identity.framework_admin_profiles`.
3. Initial application creation could duplicate on interrupted setup retries. `core.framework_state.initial_application_id` now makes creation/update retry-safe under a row lock.
4. Module routes previously continued without application context, which could bypass per-app enablement. Module routes now require `X-Application-ID` and verify enablement.
5. Admin assets/routing were mounted twice. Runtime now uses one canonical `/admin/` router and redirects `/admin` to `/admin/`.
6. The setup URL was generated without a trailing slash while the Setup Console canonicalized to one, risking loss of the one-time token query. Generated URLs now use `/setup/?token=...`, and redirect handling preserves query strings.
7. Setup same-origin checks were tied to configured `APP_BASE_URL`, making early remote/live setup brittle. They now compare browser Origin with the actual trusted request origin and respect configured proxy trust.
8. Setup cookies now use Secure when the actual request is HTTPS, even before the final live-server configuration is persisted.
9. Local setup auto-open is guarded to loopback development only and launches without shell interpolation.

## Verification

- `npm test`: PASS
- `npm run check`: PASS
- `npm run check:imports`: PASS
- Source scan for TODO/FIXME/HACK markers: reviewed
- SQL usage: application queries use parameter binding for runtime values; migrations are immutable/checksummed
- Setup/Admin static asset routing: regression-tested
- One-time setup token behavior: regression-tested
- Module application isolation: regression-tested
- Supabase Direct policy: regression-tested

## Dependency-audit limitation

Direct dependencies are exact-version pinned in `package.json`. The execution environment could not resolve `registry.npmjs.org` (`EAI_AGAIN`), so a fresh `package-lock.json` and live `npm audit` result could not be generated here. No lockfile has been fabricated. Run `npm install` followed by `npm audit` in a networked build environment before a production deployment and commit the generated lockfile.
