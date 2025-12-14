## Poke App

Small Pokédex built with TanStack Start. The server hits [PokéAPI](https://pokeapi.co/) only once, stores the list in PostgreSQL, and every subsequent request reads from the database.

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

   This command builds the `app` container, installs dependencies, starts the dev server on port 3000, and boots the `db` container with PostgreSQL plus the `pokeapp` database already created.

3. If you prefer running the app on your host machine (instead of Docker), make sure a PostgreSQL server is accessible at your `DATABASE_URL`, then run:

   ```bash
   npm run dev
   ```

4. Visit [http://localhost:3000](http://localhost:3000). The first request triggers the seed process described below.

On the first load, the `serverFn` in `src/server/pokemon.ts`:

1. Ensures the `pokemon` table exists.
2. Reads existing rows.
3. If there are none, calls PokéAPI (`POKEDEX_LIMIT` defaults to 151), saves everything to PostgreSQL, and returns the rows.

Every subsequent request uses only the database.

### Docker (app + PostgreSQL)

- Use `docker compose up --build` to run the entire stack.
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

| Variable        | Description                                              | Default                                             |
| --------------- | -------------------------------------------------------- | --------------------------------------------------- |
| `DATABASE_URL`  | PostgreSQL connection string `postgres://user:pass@...` | `postgres://postgres:postgres@localhost:5432/pokeapp` |
| `POKEDEX_LIMIT` | How many Pokémon to fetch from PokéAPI during the seed   | `151`                                               |

> 💡 When the server connects to `DATABASE_URL`, it automatically creates the target database if it does not exist (as long as PostgreSQL itself is reachable).

### Relevant structure

- `src/lib/db.ts`: lazily loads `pg` (when available) and falls back to JSON storage.
- `src/server/pokemon.ts`: table management, seeding, and data fetching logic (uses the JSON fallback when PostgreSQL/`pg` is unavailable).
- `src/routes/index.tsx`: loader + UI rendering the Pokédex.

> ⚠️ If `npm run lint` or `npm run dev` fail because `libicui18n.73.dylib` is missing, install `icu4c` (e.g. `brew install icu4c`) or update Node.js so that system dependency is available.
