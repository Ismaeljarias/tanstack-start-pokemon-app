import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { createServerFn } from '@tanstack/react-start'

import { getPool } from '@/lib/db'
import type { Pokemon } from '@/types/pokemon'

const POKEDEX_LIMIT = Number(process.env.POKEDEX_LIMIT ?? 151)
const FALLBACK_DB_PATH = path.join(process.cwd(), '.cache/pokemon.json')

async function ensureFallbackStore() {
  await mkdir(path.dirname(FALLBACK_DB_PATH), { recursive: true })
}

async function readFallbackPokemon(): Promise<Pokemon[]> {
  try {
    const buffer = await readFile(FALLBACK_DB_PATH, 'utf-8')
    return JSON.parse(buffer) as Pokemon[]
  } catch {
    return []
  }
}

async function writeFallbackPokemon(rows: Pokemon[]) {
  await ensureFallbackStore()
  await writeFile(FALLBACK_DB_PATH, JSON.stringify(rows, null, 2), 'utf-8')
}

async function ensureTable() {
  const pool = await getPool()
  if (!pool) {
    await ensureFallbackStore()
    return
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pokemon (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      sprite_url TEXT NOT NULL
    );
  `)
}

async function seedPokemon(): Promise<Pokemon[]> {
  const pool = await getPool()
  const response = await fetch(
    `https://pokeapi.co/api/v2/pokemon?limit=${POKEDEX_LIMIT}`,
  )

  if (!response.ok) {
    throw new Error('Failed to fetch data from PokéAPI')
  }

  const data = (await response.json()) as {
    results: { name: string }[]
  }

  const entries = data.results.map((pokemon, idx) => ({
    name: pokemon.name,
    spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${
      idx + 1
    }.png`,
  }))

  if (entries.length === 0) {
    return []
  }

  if (!pool) {
    const rows: Pokemon[] = entries.map((entry, index) => ({
      id: index + 1,
      name: entry.name,
      spriteUrl: entry.spriteUrl,
    }))
    await writeFallbackPokemon(rows)
    return rows
  }

  const values = entries
    .map((_, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`)
    .join(', ')
  const params = entries.flatMap((entry) => [entry.name, entry.spriteUrl])

  await pool.query(
    `INSERT INTO pokemon (name, sprite_url)
     VALUES ${values}
     ON CONFLICT (name) DO NOTHING`,
    params,
  )

  return fetchPokemon()
}

async function fetchPokemon(): Promise<Pokemon[]> {
  const pool = await getPool()
  if (!pool) {
    return readFallbackPokemon()
  }

  const { rows } = await pool.query<{
    id: number
    name: string
    sprite_url: string
  }>(`SELECT id, name, sprite_url FROM pokemon ORDER BY id ASC`)

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    spriteUrl: row.sprite_url,
  }))
}

export const listPokemon = createServerFn({
  method: 'GET',
}).handler(async () => {
  await ensureTable()

  const rows = await fetchPokemon()

  if (rows.length > 0) {
    return rows
  }

  return seedPokemon()
})
