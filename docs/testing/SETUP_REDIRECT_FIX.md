# Setup redirect fix — v0.6.4

The installer no longer depends on a `/setup` → `/setup/` redirect. Both paths render the setup console directly. Static assets use stable `/setup/assets/...` URLs and the one-time URL is generated as `/setup?token=...`. This prevents redirect loops caused by reverse proxies, HTTPS canonicalization, or trailing-slash rewrite rules.
