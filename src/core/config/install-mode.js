/**
 * PostgreSQL is the only infrastructure prerequisite for leaving first-run
 * installer mode. Redis is an optional scaling provider.
 */
export function requiresInstaller({ databaseUrl } = {}) {
  return !String(databaseUrl ?? "").trim();
}
