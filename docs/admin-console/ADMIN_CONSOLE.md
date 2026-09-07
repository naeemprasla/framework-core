# Framework Admin Console — v0.6.3

The protected Core-owned Admin Console is served at `/admin` and remains independent from application themes.

## Main areas

- Overview and health
- Applications: full-stack/headless/hybrid mode, API enablement, CORS, themes, per-app module enablement
- Modules: official/custom runtime state and schema-driven settings
- Themes
- API & Headless: application API credentials and scopes
- Infrastructure: PostgreSQL status and optional Redis setup
- Framework Settings: framework identity plus encrypted provider/runtime settings
- Operations: durable jobs and transactional outbox
- Audit and Security: admin sessions/login signals and post-login MFA enrollment

Normal framework/application/module/provider configuration should be performed here. Deployment-only concerns such as container port mapping remain hosting-level configuration.
