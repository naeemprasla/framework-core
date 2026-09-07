# Dependency Security — v0.6.3

The framework uses exact direct dependency versions in `package.json` and deliberately avoids floating ranges for the application runtime. Production builds should commit a generated `package-lock.json`, install with `npm ci`, and run `npm audit`/organization-approved SCA in CI.

The final artifact environment had no npm registry DNS access (`EAI_AGAIN`), so a fresh lockfile and registry-backed audit could not be generated without fabricating dependency metadata. This release therefore preserves exact direct pins and documents the required networked CI step rather than including a misleading lockfile.
