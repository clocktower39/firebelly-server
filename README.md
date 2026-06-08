# Firebelly Server

Express/MongoDB API for Firebelly Fitness. The server owns authentication, trainer/client authorization, workouts, schedules, sessions, groups, programs, metrics, billing, invoices, product data, file uploads, and Socket.IO collaboration.

## Stack

- Node.js
- Express 5
- MongoDB with Mongoose 9
- Socket.IO
- JSON Web Tokens
- httpOnly refresh cookies with server-side refresh token rotation
- Joi via `express-validation`
- Node test runner, Supertest, MongoDB Memory Server
- Yarn

## Quick Start

```bash
yarn install
yarn dev
```

The local server defaults to port `8000` when `PORT` is not set. The client normally proxies to `http://localhost:6969`, so keep the active backend port aligned with `firebelly-client/vite.config.js` or `VITE_PROXY_TARGET`.

## Environment

Create a local `.env` file in `firebelly-server/`.

Common variables:

```bash
PORT=6969
DBURL=mongodb://127.0.0.1:27017/firebelly
ACCESS_TOKEN_SECRET=replace-me
SALT_WORK_FACTOR=10
CORS_ORIGINS=http://localhost:3000
CLIENT_URL=http://localhost:3000
APP_BASE_URL=http://localhost:3000
EMAIL_USER=
EMAIL_PASS=
EXERCISE_ADMIN_IDS=
```

Do not commit real secrets.

## Commands

```bash
yarn dev      # nodemon app.js
yarn start    # node app.js
yarn test     # node --test
```

## Project Structure

```text
app.js               Express app, middleware, route mounting, Socket.IO setup
routes/              HTTP route definitions and route-level validation
controllers/         Request handlers
controllers/groups/  Split group domain handlers
controllers/training/Split workout/training domain handlers
middleware/          Auth and access middleware
models/              Mongoose schemas
services/            Shared domain services
tests/               Unit and integration tests
```

## Security Rules

- All protected HTTP routes must use `verifyAccessToken`.
- All write routes must use `ensureWriteAccess` unless explicitly public or read-only.
- Scope every read/write to the authenticated user, viewed delegated user, accepted trainer/client relationship, or authorized group membership.
- Use allowlists/pickers before writing request bodies to MongoDB.
- Add Joi validation to every write route.
- Do not return refresh tokens in JSON. Refresh tokens live in httpOnly cookies and are rotated server-side.
- Re-authorize Socket.IO room joins and any event that relays client-provided resource IDs.

## Verification

Before committing server changes:

```bash
yarn test
```

The integration suite uses `mongodb-memory-server`. If it fails in a restricted sandbox with `listen EPERM`, run it locally in a normal shell and record the result.

## Related Docs

- `../AGENTS.md`
- `../docs/PROJECT_CONTEXT.md`
- `../docs/ARCHITECTURE.md`
- `../docs/DECISIONS.md`
- `../docs/TODO.md`
