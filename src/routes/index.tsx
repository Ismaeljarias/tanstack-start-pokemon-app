import { createFileRoute } from '@tanstack/react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import type { Pokemon } from '@/types/pokemon'
import type { PokemonPage } from '@/server/pokemon'
import { fetchPokemonPageClient } from '@/server/pokemon'

export const Route = createFileRoute('/')({
  component: Pokedex,
})

function Pokedex() {
  const observerTarget = useRef<HTMLDivElement>(null)

  const PAGE_SIZE = 30

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<PokemonPage, Error>({
    queryKey: ['pokemon'],
    queryFn: ({ pageParam = 0 }) =>
      fetchPokemonPageClient({ offset: pageParam as number, limit: PAGE_SIZE }),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextOffset : undefined),
    initialPageParam: 0,
  })

  const allPokemon: Array<Pokemon> = data?.pages.flatMap((page) => page.data) ?? []
  const totalAvailable = data?.pages[0]?.total ?? undefined
  const hasMore = Boolean(hasNextPage)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          fetchNextPage()
        }
      },
      { threshold: 0.1, rootMargin: '500px' },
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => observer.disconnect()
  }, [hasMore, fetchNextPage])

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white py-12">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center text-gray-400">
            <p>Loading Pokémon...</p>
          </div>
        </div>
      </main>
    )
  }

  if (isError) {
    return (
      <main className="min-h-screen bg-slate-950 text-white py-12">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center text-red-400 space-y-4">
            <p>Error loading Pokémon: {error.message}</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white py-12">
      <div className="max-w-5xl mx-auto px-6">
        <header className="mb-10 text-center space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
            TanStack Pokédex
          </p>
          <h1 className="text-4xl font-semibold">Meet Your Pokémon</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Powered by TanStack Query streaming directly from PokéAPI. Scroll to
            fetch the next page automatically.
          </p>
        </header>

        {allPokemon.length === 0 ? (
          <div className="text-center text-gray-400">
            <p>No Pokémon yet. Try refreshing.</p>
          </div>
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {allPokemon.map((pokemon: Pokemon) => (
                <li
                  key={pokemon.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/30 backdrop-blur"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={pokemon.spriteUrl}
                      alt={pokemon.name}
                      width={72}
                      height={72}
                      className="h-16 w-16 object-contain drop-shadow-[0_4px_12px_rgba(59,130,246,0.45)]"
                    />
                    <div>
                      <p className="text-xs uppercase tracking-widest text-gray-400">
                        #{String(pokemon.id).padStart(3, '0')}
                      </p>
                      <h2 className="text-xl font-semibold capitalize">
                        {pokemon.name}
                      </h2>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div ref={observerTarget} className="mt-8 text-center">
              {isFetchingNextPage ? (
                <p className="text-gray-400 text-sm">Loading more Pokémon...</p>
              ) : hasMore ? (
                <p className="text-gray-500 text-sm">
                  Scroll for more ({allPokemon.length}
                  {totalAvailable ? ` of ${totalAvailable}` : ''})
                </p>
              ) : (
                <p className="text-gray-500 text-sm">
                  You've caught them all! 🎉 ({allPokemon.length} Pokémon)
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
