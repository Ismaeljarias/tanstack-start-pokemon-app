import { createServerFn } from '@tanstack/react-start'

import { prisma } from '@/lib/prisma'
import type { Pokemon } from '@/types/pokemon'

const POKEDEX_LIMIT = Number(process.env.POKEDEX_LIMIT ?? 151)

async function seedPokemon(): Promise<Pokemon[]> {
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

async function fetchPokemon(): Promise<Pokemon[]> {
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
