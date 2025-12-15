import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __prisma__client: PrismaClient | undefined
}

const prisma = globalThis.__prisma__client ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma__client = prisma
}

export { prisma }
