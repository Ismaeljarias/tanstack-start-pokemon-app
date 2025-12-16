import { createServerFn } from '@tanstack/react-start'

import type { Pokemon } from '@/types/pokemon'
import { prisma } from '@/lib/prisma'

const POKEDEX_LIMIT = Number(process.env.POKEDEX_LIMIT ?? 151)

async function seedPokemon(): Promise<Array<Pokemon>> {
  const response = await fetch(
    `https://pokeapi.co/api/v2/pokemon?limit=${POKEDEX_LIMIT}`,
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

  const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=50')
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
  const currentCount = await prisma.pokemon.count()
  const nextBatch = 50 // Load 50 more each time
  const startId = currentCount + 1
  const endId = Math.min(currentCount + nextBatch, POKEDEX_LIMIT)

  if (startId > POKEDEX_LIMIT) return // Already have all Pokemon

  const pokemonToAdd: Array<{ dexNumber: number; name: string; spriteUrl: string }> = []
  for (let i = startId; i <= endId; i++) {
    pokemonToAdd.push({
      dexNumber: i,
      name: `pokemon-${i}`, // Placeholder, we'll fetch real names
      spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${i}.png`,
    })
  }

  // Fetch real names from PokeAPI
  const response = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${nextBatch}&offset=${currentCount}`)
  if (response.ok) {
    const data = (await response.json()) as {
      results: Array<{ name: string }>
    }
    
    data.results.forEach((pokemon, idx) => {
      pokemonToAdd[idx].name = pokemon.name
    })
  }

  await prisma.pokemon.createMany({
    data: pokemonToAdd,
    skipDuplicates: true,
  })
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
