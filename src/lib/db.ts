const connectionString =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/pokeapp'

type QueryResultRow = Record<string, unknown>

export type QueryablePool = {
  query: <T extends QueryResultRow>(
    sql: string,
    params?: ReadonlyArray<unknown>,
  ) => Promise<{ rows: T[] }>
  end?: () => Promise<void>
}

type PgModule = {
  Pool: new (config: {
    connectionString: string
    max: number
    idleTimeoutMillis: number
  }) => QueryablePool
}

declare global {
  // eslint-disable-next-line no-var
  var __pokeDbPool: QueryablePool | undefined
  // eslint-disable-next-line no-var
  var __pokeDbPoolWarningShown: boolean | undefined
}

const DATABASE_NOT_FOUND_CODE = '3D000'

const parseDatabaseInfo = (urlString: string) => {
  const url = new URL(urlString)
  const database = url.pathname.replace('/', '') || 'postgres'
  const adminUrl = new URL(urlString)
  adminUrl.pathname = '/postgres'

  return {
    database,
    adminConnectionString: adminUrl.toString(),
  }
}

const ensureDatabaseExists = async (pgModule: PgModule) => {
  const { database, adminConnectionString } = parseDatabaseInfo(
    connectionString,
  )

  if (database === 'postgres') {
    return
  }

  const adminPool = new pgModule.Pool({
    connectionString: adminConnectionString,
    max: 1,
    idleTimeoutMillis: 5_000,
  })

  try {
    const existing = await adminPool.query<{ exists: number }>(
      'SELECT 1 as exists FROM pg_database WHERE datname = $1',
      [database],
    )

    if (existing.rows.length > 0) {
      return
    }

    const escapedDatabase = database.replace(/"/g, '""')
    await adminPool.query(`CREATE DATABASE "${escapedDatabase}"`)
  } finally {
    await adminPool.end?.()
  }
}

const createPool = async (pgModule: PgModule): Promise<QueryablePool> => {
  const pool = new pgModule.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 10_000,
  })

  try {
    await pool.query('SELECT 1')
    return pool
  } catch (error) {
    const databaseMissing =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === DATABASE_NOT_FOUND_CODE

    if (databaseMissing) {
      await pool.end?.()
      await ensureDatabaseExists(pgModule)
      const retryPool = new pgModule.Pool({
        connectionString,
        max: 10,
        idleTimeoutMillis: 10_000,
      })
      await retryPool.query('SELECT 1')
      return retryPool
    }

    throw error
  }
}

export const getPool = async (): Promise<QueryablePool | undefined> => {
  if (globalThis.__pokeDbPool) {
    return globalThis.__pokeDbPool
  }

  try {
    const pgModule = (await import('pg')) as PgModule
    const pool = await createPool(pgModule)
    globalThis.__pokeDbPool = pool
    return pool
  } catch (error) {
    if (!globalThis.__pokeDbPoolWarningShown) {
      globalThis.__pokeDbPoolWarningShown = true
      console.warn(
        'pg dependency is not available. Falling back to JSON storage. Install pg or use Docker for PostgreSQL support.',
        error,
      )
    }
    return undefined
  }
}
