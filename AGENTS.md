# AGENTS.md

## Global rules
- JavaScript/Node.js reference implementation; do not introduce TypeScript without an explicit architecture decision.
- Core owns runtime contracts; modules own business behavior; themes own presentation.
- Reuse stable cross-cutting behavior through focused primitives/services/SDK contracts, never giant helper files.
- Do not import private Core files from extensions.
- Keep Express, PostgreSQL, Redis and external providers behind adapters/contracts.
- Every request must carry request/correlation context.
- Never expose stack traces, SQL errors, secrets, or private implementation details to clients.
- Prefer stateless API processes and asynchronous side effects.
- New public contracts require tests and compatibility consideration.
- Optimize measured hot paths; avoid premature abstraction.
