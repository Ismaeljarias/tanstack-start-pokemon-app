## Poke App

Poke App is a minimal full-stack Pokédex:

- **Frontend**: React 19 + TanStack Start/Router, Tailwind CSS for styling.
- **Backend**: TanStack Start server functions backed by Prisma; the first request fetches data from [PokéAPI](https://pokeapi.co/) and caches it.
- **Persistence**: PostgreSQL with Prisma managing the schema (`npm run db:push`).
- **Tooling**: Vite dev server, Docker Compose for local infrastructure, ESLint/Prettier/Vitest for quality checks.

Workflow:

1. First visit to `/` calls PokéAPI (limit is configurable with `POKEDEX_LIMIT`).
2. Seed results are stored in PostgreSQL through Prisma (or JSON fallback).
3. All subsequent requests read from the local cache/database, giving instant responses even offline.

### Requirements

- Node.js 20+
- PostgreSQL 15+ (only if you are not using Docker)
- `cp .env.example .env` to define `DATABASE_URL`

### How to run

1. Install dependencies and copy the env file:

   ```bash
   npm install
   cp .env.example .env
   ```

2. Run everything with Docker:

   ```bash
   docker compose up --build
   ```

   Docker installs dependencies, runs `npm run dev`, and keeps PostgreSQL healthy. If you need Prisma to apply the schema (optional for Docker because the app auto-creates the table), run:

   ```bash
   docker compose exec app npm run db:push
   ```

   after the services are running.

3. Prefer running on your host machine? Ensure PostgreSQL is reachable at `DATABASE_URL`, then push the schema before starting Vite:

   ```bash
   npm run db:push
   npm run dev
   ```

4. Visit [http://localhost:3000](http://localhost:3000). The first request triggers the seed process described below.

On the first load, the `serverFn` in `src/server/pokemon.ts`:

1. Ensures the `pokemon` table exists.
2. Reads existing rows.
3. If there are none, calls PokéAPI (`POKEDEX_LIMIT` defaults to 151), saves everything to PostgreSQL, and returns the rows.

Every subsequent request uses only the database.

### Docker (app + PostgreSQL)

- `docker compose up --build` runs the entire stack (dev server + PostgreSQL). Run `npm run db:push` inside the container if you need Prisma to manage the schema explicitly.
- Stop everything with `docker compose down`. Use `-v` if you want to delete the persisted database volume (`pgdata`).

### Useful scripts

```bash
npm run dev       # Vite + TanStack Start dev server
npm run build     # production build
npm run preview   # preview the build
npm run test      # Vitest
npm run lint      # eslint
npm run format    # prettier
```

### Environment variables

| Variable        | Description                                              | Default                                               |
| --------------- | -------------------------------------------------------- | ----------------------------------------------------- |
| `DATABASE_URL`  | PostgreSQL connection string `postgres://user:pass@...` | `postgres://postgres:postgres@localhost:5432/pokeapp` |
| `POKEDEX_LIMIT` | How many Pokémon to fetch from PokéAPI during the seed   | `151`                                                 |

### Relevant structure

- `prisma/schema.prisma`: Prisma schema for the Pokédex data (run `npm run db:push` to sync).
- `src/lib/prisma.ts`: singleton Prisma Client instance.
- `src/server/pokemon.ts`: table management, seeding, and data fetching logic backed by Prisma.
- `src/routes/index.tsx`: loader + UI rendering the Pokédex.

> ⚠️ If `npm run lint` or `npm run dev` fail because `libicui18n.73.dylib` is missing, install `icu4c` (e.g. `brew install icu4c`) or update Node.js so that system dependency is available.
