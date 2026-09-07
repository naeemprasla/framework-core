# Admin Console Implementation — v0.6.0

The Admin Console uses same-origin HttpOnly administrator sessions and protected JSON control-plane routes. State-changing routes use same-origin protection and Framework Admin/Super Admin authorization.

Application configuration is persisted in PostgreSQL. Secret module/provider values use authenticated encryption. Headless clients are isolated by application context and per-application CORS. API credentials are shown once and stored hashed.

Custom modules placed under `custom-modules/` are discovered through the same manifest validator and scoped Module SDK as official modules. Administrators enable them per application and configure declared settings from generated dashboard forms.
