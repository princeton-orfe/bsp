Project plan: Automated Drupal 10 UI testing and interactive headful login

Overview

This project provides an automation platform that drives a Drupal 10 web UI in a headful browser environment running inside Docker. It exposes an HTTP API (Node/Express) that triggers UI actions via Playwright. The platform supports:

- Programmatic (Playwright) UI automation for login, content creation and other flows.
- An interactive headful login flow by exposing a VNC/noVNC UI to human operators.
- Persistent Playwright browser context (storageState) so long-lived sessions can be reused.
- A test suite (Jest + Supertest) for the API surface and key behaviors.

Goals

1. Provide a simple REST surface that client apps or CI can call to perform UI-driven actions against a Drupal 10 site.
2. Allow operators to perform an interactive headful login via a browser-accessible VNC (noVNC) endpoint when programmatic login is not possible.
3. Keep browser state between runs when requested so subsequent calls reuse an authenticated session.
4. Make the automation robust and observable (logs, screenshots, health endpoints).
5. Provide a clear test suite and developer documentation to extend automation flows (CRUD operations).

High-level Architecture

- Node.js + Express server that exposes REST endpoints.
- Playwright manager module which launches/connects to Chromium, creates contexts/pages, and runs UI scripts.
- Docker image which bundles the Node app, Playwright browsers, and a headful display stack (Xvfb + x11vnc + websockify + noVNC).
- Supervisord (or equivalent) manages background processes inside the container so the display stack and web server are started automatically.
- Persistent storage: browser context storage files (e.g. storage/storageState.json) saved to disk across container restarts.

API Endpoints (current & roadmap)

Core endpoints implemented / planned now:
- POST /login
  - Triggers a programmatic login flow that uses Playwright to navigate the Drupal login UI and persist the authenticated storageState.
  - Accepts credentials via request body (or uses configured secrets) and returns success/failure and a short token or indicator.
- POST /login/interactive
  - Creates a fresh browser context attached to the headful display and returns connection metadata (noVNC URL) so an operator can open the VNC UI and log in interactively.
- GET /login/check
  - Returns whether the Playwright context is currently authenticated (based on cookies / current page check).
- POST /logout
  - Clears stored storageState, closes the Playwright context, and optionally invalidates any session tokens.
- POST /add
  - Triggers a programmatic UI flow to add content (node creation) via the Drupal UI. Accepts content fields in the request body.
- GET /add/check
  - Verifies that the last /add action succeeded (e.g., by confirming the created node appears in content lists).

Supporting/debug endpoints:
- GET /playwright/ready
  - Health check for the Playwright manager and whether a browser process is available.
- GET /debug/screenshot
  - Captures and returns or saves a screenshot of the current headful page (useful for debugging interactive sessions).
- GET /health
  - General container health endpoint.

Extended CRUD roadmap (developer tasks)

We plan to expand the API to fully cover content lifecycle operations through the Drupal admin UI: create, read, update, delete (CRUD) for nodes, taxonomy, users and simple config changes.

Suggested endpoints and behaviors:
- POST /nodes
  - UI-driven node creation. Accepts: type, title, body, fields. Returns: node id, URL, status.
- GET /nodes/:id
  - Verifies node presence via UI listing or direct HTTP read for confirmation.
- PATCH /nodes/:id
  - UI-driven node update flow (navigate to edit form, submit changes).
- DELETE /nodes/:id
  - UI-driven node deletion flow, with confirmation checks.
- Similarly for /taxonomy, /users, /files where a developer can implement UI action flows.

Security and Secrets

- Credentials and sensitive data MUST be supplied through environment variables, mounted secrets, or a secure vault; avoid plain-text credentials in API payloads for production.
- API should be protected with an authentication layer for callers (API key or OAuth token) to avoid open triggers that operate as an admin on the Drupal UI.

Playwright & Browser Handling Contract

Inputs:
- Actions/commands via HTTP API (login, add, logout, etc.).
- Optional credentials or content payloads in request body.
Outputs:
- JSON success/failure responses with helpful messages and IDs.
- Side-effects: storageState file updates for authenticated session; created content in Drupal.
- Diagnostic artifacts: screenshots saved to /tmp or a configured artifacts directory.

Error modes and retry semantics:
- Transient browser launch/connect errors: retry with backoff and log details.
- UI flow failures: capture a screenshot + page HTML, then return a 4xx/5xx response with pointers to artifacts.
- If Playwright context is invalid (cookie expiry), the manager should try to refresh via the stored storageState or request re-authentication.

Tests

- Unit tests (Jest) for server routes: mock the Playwright manager to test route behavior, responses, and error handling.
- Integration tests (Supertest) for the API surface. These tests can run in CI using a headless configuration that provides an isolated Playwright browser.
- End-to-end tests (optional): run the service inside a Docker test image and use Playwright to exercise full interactive login and content creation flows.

Developer onboarding notes

- Workspace layout: server code in `src/`, tests in `tests/`, Playwright helper module in `src/playwrightManager.js`.
- Key files:
  - `server.js` — Express server and route registration.
  - `playwrightManager.js` — Browser lifecycle and action flows.
  - `Dockerfile`, `docker-compose.yml` — Container orchestration and local dev setup.
  - `supervisord.conf` — manages Xvfb, x11vnc, websockify and the Node process when running the headful image.
- How to run locally (dev):
  - Build the Docker image and run via docker-compose.
  - For tests: `npm test` runs Jest unit tests. Integration tests may require a running container.

Observability & Debugging

- Provide /debug/screenshot and /playwright/ready endpoints for quick checks from CI.
- Save diagnostic artifacts (screenshots, HTML dumps, Playwright console logs) to a mounted artifacts directory for CI to collect.
- Keep detailed Playwright and server logs; surface them in container logs for troubleshooting.

Roadmap & Priorities

Phase 1 (MVP)
- Implement core API endpoints: login, login/interactive, login/check, logout, add, add/check.
- Implement Playwright manager to launch and manage Chromium and persist storageState.
- Add unit tests for API routes and Playwright manager mocks.
- Containerize with headful stack and ensure interactive noVNC access for manual login.

Phase 2 (stability)
- Harden browser start/connect logic and add retries/backoff.
- Improve logging, artifacts collection, and health endpoints.
- Add content-specific UI flows for nodes and taxonomy.

Phase 3 (feature parity)
- Implement full CRUD endpoints for nodes, taxonomy, users.
- Add RBAC and API authentication, plus safer secret handling.
- Add E2E tests that exercise the full interactive login and content lifecycle.

Contact / contributors

- Add a short CONTRIBUTORS.md with who to contact for Playwright, container and Drupal domain expertise.

---
Saved as PLAN.md in repository root.
