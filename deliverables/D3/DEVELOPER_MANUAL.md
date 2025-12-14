# Developer Manual

This guide helps new contributors set up, understand, and extend the Study Weave project.

## System Overview
Study Weave is a full-stack web app composed of a React (Vite) single-page frontend and a Node.js (Express) backend API. The backend uses PostgreSQL via Sequelize ORM, and the frontend communicates with it over REST endpoints secured by JWT-based authentication.

## 1) Getting the Source
- Clone: `git clone https://github.com/CS319-25-FA/S1-T9-study-weave.git`
- Worktree: root contains `client/` (React/Vite SPA) and `server/` (Express/Sequelize API).
- Recommended versions: Node.js v18.x (LTS), npm v9+, PostgreSQL v14 or v15.

## 2) Environment & Configuration
- Create `.env` at repo root (do not commit secrets). Required keys:
  - Database: `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT`
  - Auth: `JWT_SECRET`
  - Server port: `PORT` (API default 5200)
  - Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`
  - LLM: `GEMINI_API_KEY`, `GEMINI_LLM_NAME`
- Backend reads `.env` and `server/config/database.js`. Frontend expects API at `http://localhost:5200` (see `client/src/api/axios.js`).

## 3) Install & Run
**Backend (server/):**
- `npm install`
- Database: `npx sequelize-cli db:migrate` (if schema changes) and `npm run db:seed` for sample data.
- Dev server: `npm run dev` (nodemon). Production: `npm start`.
- Tests: `npm test` (Jest).

**Frontend (client/):**
- `npm install`
- Dev server: `npm run dev` (Vite, default http://localhost:5173).
- Build: `npm run build`; Preview: `npm run preview`.
- Lint: `npm run lint`; Tests: `npm run test` (Vitest/JSDOM).

**Build Order**
- Start the backend first; the frontend depends on the API for authentication and data.

## 4) Project Layout
- `client/`
  - `src/main.jsx` - Route table (React Router v7). Layouts:
    - `/participant` -> `ParticipantLayout.jsx` (dashboard, competency, artifacts comparison, studies).
    - `/researcher` -> `ResearcherLayout.jsx` (dashboard, artifacts, assessment creation, competency review, reviewer view, studies).
    - Auth routes: `/login`, `/register`, `/forgot-password`, `/reset-password/:token`, `/profile`.
  - `src/App.jsx` - Root shell used by all routes.
  - `src/api/axios.js` - Axios instance (baseURL `http://localhost:5200`, attaches JWT from `localStorage`, redirects to `/login` on 401).
  - `src/assets/App.css` - Global theming (light/dark tokens).
  - `src/components/ui/` - Shared UI primitives (Radix-based).
  - `src/components/dashboard/` - Dashboard widgets.
  - `src/hooks/` - Shared hooks (`useDashboardPreferences`, `use-toast`).
  - `src/lib/studyTimer.js` - Study timer utilities.
  - `src/pages/` - Page-level views (dashboards, study flows, auth, profile, adjudication).
  - `src/pages/__tests__/` - Integration tests (Vitest).
- `server/`
  - `server.js` - Express entrypoint.
  - `routes/` - Route modules (auth, participant, researcher, reviewer, artifacts, competency, studies, etc.).
  - `controllers/` - Business logic (e.g., `artifactAssessmentsController.js`).
  - `middleware/auth.js` - JWT guard.
  - `models/` - Sequelize models used at runtime.
  - `sequelize-models/` - CLI-generated model definitions for migrations/seeding.
  - `migrations/`, `seeders/` - Schema and seed data.
  - `services/` - Email, notifications, LLM helpers.
  - `config/` - DB config, app config, LLM system instructions.
  - `uploads/` - Stored files (dev).

## 5) Coding Conventions
- **Frontend**
  - Functional components with hooks; keep data-fetching in pages/layouts, keep UI components presentational.
  - Styling via Tailwind utilities plus theme variables in `App.css`; reuse `components/ui` primitives.
  - Forms: prefer `react-hook-form` + `zod` schema validation; show user-friendly errors.
  - API calls: use the shared `axios` instance; handle errors with toasts or inline messages.
  - Routing state: when linking to profile, pass `state: { from: location.pathname }` so back navigates to the correct dashboard.
- **Backend**
  - Keep routes thin; controllers handle logic; services for cross-cutting concerns.
  - Use `async/await` with `try/catch`; return meaningful HTTP codes/messages.
  - Protect private routes with `middleware/auth.js`; expect `Authorization: Bearer <token>`.
  - Keep migrations in sync with model changes; add seeds when needed for test data.
- **Testing/Linting**
  - Frontend: `npm run lint` then `npm run test` before PRs.
  - Backend: `npm test` (Jest). Add tests for controllers/services when fixing bugs.

## 6) Common Tasks
- **Add an API endpoint:** create controller (server/controllers), add route (server/routes/*), wire middleware, update models/migrations if needed, add tests.
- **Add a page/view:** add file under `client/src/pages`, register the route in `src/main.jsx`, reuse layout wrappers.
- **Add shared UI:** add component to `client/src/components/ui`, keep theme compatibility (respect CSS vars).
- **Update study timer logic:** utilities in `client/src/lib/studyTimer.js`; participant UI primarily in `ArtifactsComparison.jsx` and dashboard cards.
- **Profile nav behavior:** `Profile.jsx` reads `location.state?.from` with role fallbacks (`/researcher/reviewer` for reviewer, `/participant` for participant, `/researcher` for researcher). Pass `state` when navigating to preserve return path.

## 7) Build & Deploy (overview)
- Backend: `npm ci`, migrate DB, run `npm start` behind a process manager (PM2/systemd); set `PORT` and `.env` in the target environment.
- Frontend: `npm ci && npm run build`; deploy `client/dist` to static hosting; ensure API base URL matches deployment (adjust `axios` baseURL or use env-based config pre-build).
- Reverse proxy: serve static assets and proxy API requests to the backend; enable HTTPS and secure cookies in production.

## 8) Security & Secrets
- Never commit real `.env` values. Rotate leaked keys immediately.
- Use strong `JWT_SECRET` per environment.
- Consider enabling HTTPS and `withCredentials` if cookies are used; currently JWT lives in `localStorage`.

## 9) Troubleshooting
- Redirect to login unexpectedly: token missing or expired leads to 401; axios interceptor clears auth and redirects.
- CORS or port mismatch: confirm backend `PORT` and frontend `axios` baseURL align.
- Migrations failing: verify Postgres credentials and that the target database exists; rerun `npx sequelize-cli db:migrate`.
- UI theming off: adjust CSS variables in `client/src/assets/App.css`; UI primitives pick up those tokens.
- Timer or study status issues: inspect `client/src/lib/studyTimer.js` and page logic in `ArtifactsComparison.jsx`.

## 10) Contribution Workflow
- Branch from `main`; use feature branches (`feat/<area>`, `fix/<issue>`).
- Keep PRs small; include tests/lint runs. Document schema changes and provide migration/seed steps.
- Update this manual when workflows or tooling change.

Happy building!
