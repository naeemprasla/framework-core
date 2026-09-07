# Security Status — v0.6.0

Current controls include protected Framework Admin authority, HttpOnly SameSite admin sessions, optional TOTP MFA enforced after enrollment, bounded password hashing, login throttling, token peppering, encrypted runtime/module/provider secrets, one-time setup token, permanent setup lock, same-origin admin mutations, safe error envelopes, path-confined storage, non-executable templates, migration locking, durable jobs/outbox, module dependency/capability restrictions, per-application module enablement, per-app API/CORS controls, and hashed API credentials.

## Custom module trust boundary

Developer-authored modules under `custom-modules/` are treated as trusted deployment code but still receive the scoped Module Context for framework access. Node.js code loaded in-process is not a security sandbox; untrusted community modules require a future process/container isolation runtime and must not be copied into this trusted directory.

## Production gates

Use HTTPS, protect the runtime encryption key, use least-privilege PostgreSQL identities, generate/commit a dependency lockfile in CI, run dependency/SBOM scanning, test backups/restores, and execute live PostgreSQL staging tests before production promotion.
