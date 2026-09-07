# Build Status — v0.6.3 Final Audited Dashboard-First Headless Core

Implemented:

- Four-step initial setup: Server → Database → Application → Super Admin.
- Local/live setup policy with live HTTPS requirement and database SSL preference.
- PostgreSQL-only required infrastructure; Redis remains optional.
- Login redirect after setup; no automatic Super Admin login.
- Optional post-login TOTP MFA enrollment with one-time recovery codes; enrolled MFA is enforced on later logins.
- Application delivery modes: full-stack, headless, hybrid.
- Per-application API enablement and CORS origins.
- Headless application resolution through `X-Application-ID`.
- Hashed application API/service credentials with scoped metadata.
- Official + trusted local custom module discovery through the same Module Runtime.
- Per-application module enable/disable state.
- Module-route entitlement checks when application context is present.
- Schema-driven module settings and encrypted module secrets.
- Application theme selection through dashboard configuration.
- Dashboard-managed optional Redis connection with connection test and encrypted runtime persistence.
- Dashboard encrypted provider/runtime settings.
- Admin Console, jobs/outbox, health, audit and security foundations retained.

Verification: JavaScript syntax, relative import integrity, full Node test suite and Core lifecycle E2E are expected to pass before packaging.


## v0.6.1 Supabase Setup

- Supabase Direct Database is the recommended first-run database path.
- Direct-host/port/SSL policy is validated before connection.
- Supavisor/pooler URLs are rejected in Direct mode.
- Generic PostgreSQL remains supported.
- Setup wizard UI redesigned and responsive.
- Regression suite: 42/42 passing.

## v0.6.2 asset-link hardening
- Setup/Admin console browser assets now use route-relative links.
- `/setup` canonicalizes to `/setup/` before HTML is served so relative assets resolve predictably.
- Static CSS/JS responses set explicit MIME types.
- Added console asset-link regression tests.
- Detailed project documentation moved under `docs/` per repository policy.
- Verification: 45/45 tests PASS, syntax PASS, relative import integrity PASS.

## v0.6.3 final audit

- Safe local automatic setup URL launch.
- Canonical token-preserving setup URL.
- Centralized framework version source.
- Persisted Super Admin profile.
- Retry-safe initial application creation.
- Application context required for all module routes.
- Single canonical Admin Console router/static mount.
- Remote/live setup origin handling hardened.
- Verification: 51/51 tests PASS, syntax PASS, relative import integrity PASS.
