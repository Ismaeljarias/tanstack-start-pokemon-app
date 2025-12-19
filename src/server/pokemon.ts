import { createServerFn } from '@tanstack/react-start'

import type { Pokemon } from '@/types/pokemon'
import { prisma } from '@/lib/prisma'

const POKEDEX_LIMIT = Number.isFinite(Number(process.env.POKEDEX_LIMIT))
  ? Number(process.env.POKEDEX_LIMIT)
  : Infinity
const BATCH_SIZE = 200

async function getPokedexCount(): Promise<number> {
  // Using pokemon-species to avoid alternate forms that lack sprites
  const response = await fetch('https://pokeapi.co/api/v2/pokemon-species?limit=1')

  if (!response.ok) {
    throw new Error('Failed to fetch Pokédex species count from PokéAPI')
  }

  const data = (await response.json()) as { count: number }
  return data.count
}

async function seedPokemon(): Promise<Array<Pokemon>> {
  const pokedexCount = await getPokedexCount()
  const targetCount = Math.min(pokedexCount, POKEDEX_LIMIT)
  if (targetCount === 0) {
    return []
  }
  const response = await fetch(
    `https://pokeapi.co/api/v2/pokemon-species?limit=${targetCount}`,
  )

  if (!response.ok) {
    throw new Error('Failed to fetch data from PokéAPI')
  }

  const data = (await response.json()) as {
    results: Array<{ name: string }>
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

  await prisma.pokemon.createMany({
    data: entries.map((entry, index) => ({
      dexNumber: index + 1,
      name: entry.name,
      spriteUrl: entry.spriteUrl,
    })),
    skipDuplicates: true,
  })

  return fetchPokemon()
}

async function fetchPokemon(): Promise<Array<Pokemon>> {
  const rows = await prisma.pokemon.findMany({
    orderBy: { dexNumber: 'asc' },
  })

  return rows.map((row) => ({
    id: row.dexNumber,
    name: row.name,
    spriteUrl: row.spriteUrl,
  }))
}

export const listPokemon = createServerFn({
  method: 'GET',
}).handler(async () => {
  const rows = await fetchPokemon()

  if (rows.length > 0) {
    return rows
  }

  return seedPokemon()
})

export interface PaginatedResponse {
  data: Array<Pokemon>
  nextPage: number | null
  hasMore: boolean
  total: number
}


// Seed initial 50 Pokemon
async function seedInitialPokemon(): Promise<void> {
  const count = await prisma.pokemon.count()
  if (count >= 50) return // Already have initial batch

  const initialLimit = Math.max(
    0,
    Math.min(50, Number.isFinite(POKEDEX_LIMIT) ? POKEDEX_LIMIT : 50),
  )
  if (initialLimit === 0) return

  const response = await fetch(
    `https://pokeapi.co/api/v2/pokemon-species?limit=${initialLimit}`,
  )
  const data = (await response.json()) as {
    results: Array<{ name: string }>
  }

  const entries = data.results.map((pokemon, idx) => ({
    dexNumber: idx + 1,
    name: pokemon.name,
    spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${idx + 1}.png`,
  }))

  await prisma.pokemon.createMany({
    data: entries,
    skipDuplicates: true,
  })
}

// Load more Pokemon in background
async function loadMorePokemon(): Promise<void> {
  const pokedexCount = await getPokedexCount()
  const targetCount = Math.min(pokedexCount, POKEDEX_LIMIT)

  if (targetCount === 0) return

  let currentCount = await prisma.pokemon.count()
  // If older runs added form variants, trim anything beyond the official species count
  if (currentCount > targetCount) {
    await prisma.pokemon.deleteMany({
      where: { dexNumber: { gt: targetCount } },
    })
    currentCount = targetCount
  }

  while (currentCount < targetCount) {
    const startId = currentCount + 1
    const batchSize = Math.min(BATCH_SIZE, targetCount - currentCount)

    const pokemonToAdd: Array<{ dexNumber: number; name: string; spriteUrl: string }> = []
    for (let i = 0; i < batchSize; i++) {
      const dexNumber = startId + i
      pokemonToAdd.push({
        dexNumber,
        name: `pokemon-${dexNumber}`, // Placeholder, we'll fetch real names
        spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexNumber}.png`,
      })
    }

    const response = await fetch(
      `https://pokeapi.co/api/v2/pokemon-species?limit=${batchSize}&offset=${startId - 1}`,
    )
    if (response.ok) {
      const data = (await response.json()) as {
        results: Array<{ name: string }>
      }

      data.results.forEach((pokemon, idx) => {
        if (pokemonToAdd[idx]) {
          pokemonToAdd[idx].name = pokemon.name
        }
      })
    }

    await prisma.pokemon.createMany({
      data: pokemonToAdd,
      skipDuplicates: true,
    })

    currentCount += batchSize
  }
}

// Get all Pokemon from DB (will load more in background as needed)
export const getAllPokemon = createServerFn({
  method: 'GET',
}).handler(async () => {
  // Ensure we have initial Pokemon
  await seedInitialPokemon()

  // Start background loading job
  loadMorePokemon().catch(console.error)

  // Get all current Pokemon from DB
  const pokemon = await prisma.pokemon.findMany({
    orderBy: { dexNumber: 'asc' },
  })

  const mappedPokemon = pokemon.map((row) => ({
    id: row.dexNumber,
    name: row.name,
    spriteUrl: row.spriteUrl,
  }))

  return mappedPokemon
})
