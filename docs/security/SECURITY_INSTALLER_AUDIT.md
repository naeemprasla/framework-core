# Installer Security Notes — v0.6.3

- One-time high-entropy setup token is exchanged for an HttpOnly SameSite setup session.
- Setup mutation endpoints reject cross-origin/cross-site requests.
- PostgreSQL credentials and generated token pepper are stored in the encrypted runtime store, not plaintext project config.
- Setup finalization is guarded by framework state and first-Super-Admin creation locking.
- Normal runtime does not mount installer routes after initialization.
- Setup redirects to login instead of issuing an authenticated admin session.
- MFA is optional during basic installation, can be enrolled from the protected Admin Console, and is enforced when enrolled.
- Module/provider secret settings use authenticated encryption and are never returned in plaintext from list/read APIs.
- Headless API credentials are stored as hashes and shown only at creation.
- Custom in-process modules are trusted deployment code; untrusted package execution requires process/container isolation and is intentionally not claimed as sandboxed.
