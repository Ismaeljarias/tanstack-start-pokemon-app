import { createServerFn } from '@tanstack/react-start'

import type { Pokemon } from '@/types/pokemon'

const POKEDEX_LIMIT = Number.isFinite(Number(process.env.POKEDEX_LIMIT))
  ? Number(process.env.POKEDEX_LIMIT)
  : Infinity

export interface PokemonPageInput {
  limit?: number
  offset?: number
}

export interface PokemonPage {
  data: Array<Pokemon>
  nextOffset: number | null
  hasMore: boolean
  total: number
}

let cachedPokedexCount: number | null = null

async function getPokedexCount(): Promise<number | null> {
  if (cachedPokedexCount !== null) return cachedPokedexCount

  // Using pokemon-species to avoid alternate forms that lack sprites
  try {
    const response = await fetch('https://pokeapi.co/api/v2/pokemon-species?limit=1')

    if (!response.ok) {
      throw new Error('Failed to fetch Pokédex species count from PokéAPI')
    }

    const data = (await response.json()) as { count: number }
    cachedPokedexCount = Math.min(data.count, POKEDEX_LIMIT)
    return cachedPokedexCount
  } catch (error) {
    console.error('Failed to fetch Pokédex count', error)
    return null
  }
}

async function fetchPokemonPage(limit = 20, offset = 0): Promise<PokemonPage> {
  const pokedexCount = await getPokedexCount()
  if (!pokedexCount || pokedexCount <= 0) {
    return { data: [], nextOffset: null, hasMore: false, total: 0 }
  }

  const safeLimit = Math.max(0, Math.min(limit, pokedexCount - offset))
  if (safeLimit <= 0) {
    return { data: [], nextOffset: null, hasMore: false, total: pokedexCount }
  }

  const response = await fetch(
    `https://pokeapi.co/api/v2/pokemon-species?limit=${safeLimit}&offset=${offset}`,
  )

  if (!response.ok) {
    throw new Error('Failed to fetch data from PokéAPI')
  }

  const data = (await response.json()) as {
    results: Array<{ name: string }>
  }

  const entries = data.results.map((pokemon, idx) => {
    const dexNumber = offset + idx + 1
    return {
      id: dexNumber,
      name: pokemon.name,
      spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexNumber}.png`,
    }
  })

  const nextOffset = offset + safeLimit
  const hasMore = nextOffset < pokedexCount

  return {
    data: entries,
    nextOffset: hasMore ? nextOffset : null,
    hasMore,
    total: pokedexCount,
  }
}

export const listPokemonPage = createServerFn({
  method: 'GET',
}).handler(async ({ data }: { data?: PokemonPageInput }) => {
  const input = data ?? ({} as PokemonPageInput)
  const limit = Number.isFinite(input.limit) ? Number(input.limit) : 30
  const offset = Number.isFinite(input.offset) ? Number(input.offset) : 0

  return fetchPokemonPage(limit, offset)
})

// Thin wrapper to provide a typed client call signature
export function fetchPokemonPageClient(input: PokemonPageInput = {}) {
  return listPokemonPage({ data: input } as any)
}
