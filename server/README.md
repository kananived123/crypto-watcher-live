# Background Trader Worker

This worker keeps the profile auto-trader running even when no browser is open.

## What it does

- Runs a 1-second trading loop.
- Stores full profile/trade state in a local file:
  - `server/data/profile-state.json`
- Exposes API endpoints used by the Profile page:
  - `GET /api/profile-state`
  - `POST /api/profile-settings`
  - `POST /api/profile-reset`

## Run locally

```bash
npm run trader:worker
```

Default port is `8787`.

## Connect frontend to worker

Set Vite env var:

```bash
VITE_TRADER_API_URL=http://localhost:8787
```

When this variable is set:

- Browser background trader daemon is disabled.
- Profile page reads/writes state from worker API.
- Trading continues in worker process even if browser is closed.

## Production note

This requires an always-on server (VM, VPS, Render/Railway worker, etc.).
Static hosting/serverless-only platforms cannot run a permanent 1-second background process.
