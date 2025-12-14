import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const require = createRequire(import.meta.url)

type PokemonRecord = {
  dexNumber: number
  name: string
  spriteUrl: string
}

type PrismaLike = {
  pokemon: {
    findMany: (args?: {
      orderBy?: {
        dexNumber?: 'asc' | 'desc'
      }
    }) => Promise<PokemonRecord[]>
    createMany: (args: {
      data: PokemonRecord[]
      skipDuplicates?: boolean
    }) => Promise<{ count: number }>
  }
}

const jsonStorePath = path.join(process.cwd(), '.cache/pokemon.json')

async function ensureStore() {
  await mkdir(path.dirname(jsonStorePath), { recursive: true })
}

async function readStore(): Promise<PokemonRecord[]> {
  try {
    const buffer = await readFile(jsonStorePath, 'utf-8')
    return JSON.parse(buffer) as PokemonRecord[]
  } catch {
    return []
  }
}

async function writeStore(rows: PokemonRecord[]) {
  await ensureStore()
  await writeFile(jsonStorePath, JSON.stringify(rows, null, 2), 'utf-8')
}

function createJsonFallback(): PrismaLike {
  return {
    pokemon: {
      async findMany(args) {
        const rows = await readStore()
        if (args?.orderBy?.dexNumber === 'desc') {
          return [...rows].sort((a, b) => b.dexNumber - a.dexNumber)
        }
        return [...rows].sort((a, b) => a.dexNumber - b.dexNumber)
      },
      async createMany({ data, skipDuplicates }) {
        const rows = await readStore()
        const map = new Map(rows.map((row) => [row.dexNumber, row]))

        for (const entry of data) {
          if (skipDuplicates && map.has(entry.dexNumber)) {
            continue
          }
          map.set(entry.dexNumber, entry)
        }

        const nextRows = Array.from(map.values()).sort(
          (a, b) => a.dexNumber - b.dexNumber,
        )

        await writeStore(nextRows)

        return { count: nextRows.length }
      },
    },
  }
}

function createPrismaClient(): PrismaLike {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaClient } = require('@prisma/client') as {
      PrismaClient: new () => PrismaLike
    }

    return new PrismaClient()
  } catch (error) {
    console.warn(
      'Prisma client not available. Falling back to JSON storage in .cache/pokemon.json.',
      error,
    )
    return createJsonFallback()
  }
}

export const prisma = createPrismaClient()
