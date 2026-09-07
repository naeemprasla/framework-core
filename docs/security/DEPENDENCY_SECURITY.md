# Dependency Security Notes — 2026-09-08

The previous package had no `package-lock.json`, so a reproducible `npm audit` could not be completed in this execution environment. An attempt to generate a lockfile timed out due package-registry access.

Actions taken:

- removed floating `^` ranges from top-level runtime dependencies;
- documented that deployment CI must generate/commit a lockfile and run dependency/SBOM scanning;
- reviewed current public npm/GitHub security information for major runtime dependencies;
- pinned the local development Redis server image to `redis:8.2.9-alpine`, which is on a patched branch for the August 2026 Redis TLS use-after-free advisory.

Do not interpret absence of a local `npm audit` result as proof that the dependency tree has no vulnerabilities. CI should treat vulnerability scanning and lockfile integrity as a release gate.
