# Installation — v0.6.3

1. Extract the framework.
2. Install Node.js 22+ dependencies with your deployment pipeline.
3. Start the framework with `npm start`.
4. Open the one-time `/setup?token=...` URL printed by the process.
5. Choose **Local Development** or **Live Server**.
6. Enter PostgreSQL host, port, database, username, password, and SSL preference. PostgreSQL is verified and migrations run server-side.
7. Enter application name, URL, delivery mode (`fullstack`, `headless`, or `hybrid`), locale and timezone.
8. Create the first Framework Super Admin with email/password.
9. Setup is atomically finalized and permanently locked.
10. Go to `/admin` and sign in with the credentials just created.
11. Complete advanced setup from the dashboard: MFA, modules, themes, API/CORS, providers, optional Redis, and operational settings.

Redis is intentionally absent from the initial installer. The built-in local cache is used until Redis is enabled from `Admin → Infrastructure`.

For a live server, use HTTPS. The installer persists live-server mode and the application origin into the encrypted runtime configuration used after handoff.


## Supabase Direct Database

During **Step 2 — Database**, Supabase Direct is the default option. In the Supabase project dashboard, choose **Connect** and copy the **Direct connection** string. The installer accepts direct endpoints in the form `db.<project-ref>.supabase.co:5432`, enforces SSL, tests the connection, and runs Core migrations. Pooler endpoints are intentionally rejected when Direct mode is selected.

Supabase Direct connections are IPv6 by default unless the project has IPv4 support. Your deployment server therefore needs compatible network connectivity. Generic PostgreSQL can be selected from the same setup screen when the framework is not using Supabase.

## Automatic local setup launch

After the installer server successfully binds, local development installations open the one-time setup URL in the operating system's default browser. The generated URL is canonical (`/setup/?token=...`) so the token survives routing. Production, CI/test, and non-loopback deployments do not auto-launch a browser. Set `AUTO_OPEN_SETUP=false` when running a local process without a desktop session.
