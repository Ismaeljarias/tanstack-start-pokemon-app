import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { Pokemon } from '@/types/pokemon'
import { getAllPokemon } from '@/server/pokemon'

export const Route = createFileRoute('/')({
  component: Pokedex,
})

function Pokedex() {
  const observerTarget = useRef<HTMLDivElement>(null)


  // Get all available Pokemon (starts with 50, background loads more)
  const {
    data: allPokemonData,
    isLoading,
    isError,
    error,
  } = useQuery<Array<Pokemon>, Error>({
    queryKey: ['pokemon'],
    queryFn: () => getAllPokemon(),
    refetchInterval: 5000, // Refetch every 5 seconds to get newly loaded Pokemon
  })

  const [displayedPokemon, setDisplayedPokemon] = useState<Array<Pokemon>>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const ITEMS_PER_BATCH = 20
  const totalAvailable = allPokemonData?.length ?? 0
  const hasMore = displayedPokemon.length < totalAvailable

  // Initialize with first 20 Pokemon
  useEffect(() => {
    if (allPokemonData && displayedPokemon.length === 0) {
      setDisplayedPokemon(allPokemonData.slice(0, ITEMS_PER_BATCH))
      setCurrentIndex(ITEMS_PER_BATCH)
    }
  }, [allPokemonData, displayedPokemon.length])


  const loadMore = useCallback(() => {
    if (!allPokemonData || displayedPokemon.length >= totalAvailable || isLoadingMore) return
    
    setIsLoadingMore(true)
    
    // Simulate loading delay to show loading state
    setTimeout(() => {
      const nextIndex = currentIndex + ITEMS_PER_BATCH
      const newPokemon = allPokemonData.slice(currentIndex, Math.min(nextIndex, allPokemonData.length))
      
      if (newPokemon.length > 0) {
        setDisplayedPokemon(prev => [...prev, ...newPokemon])
        setCurrentIndex(nextIndex)
      }
      
      setIsLoadingMore(false)
    }, 300) // Small delay to show loading state
  }, [allPokemonData, currentIndex, displayedPokemon.length, totalAvailable, ITEMS_PER_BATCH, isLoadingMore])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore()
        }
      },
      { threshold: 0.1, rootMargin: '500px' },
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loadMore])

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
            We pull the data from PokéAPI the first time you start the project,
            then read everything from PostgreSQL so the experience stays fast
            and reliable. Scroll down to load more!
          </p>
        </header>

        {displayedPokemon.length === 0 ? (
          <div className="text-center text-gray-400">
            <p>No Pokémon yet. Try refreshing.</p>
          </div>
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayedPokemon.map((pokemon: Pokemon) => (
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
              {isLoadingMore ? (
                <p className="text-gray-400 text-sm">Loading more Pokémon...</p>
              ) : hasMore ? (
                <p className="text-gray-500 text-sm">
                  Scroll for more ({displayedPokemon.length} of {totalAvailable})
                </p>
              ) : (
                <p className="text-gray-500 text-sm">
                  You've caught them all! 🎉 ({displayedPokemon.length} Pokémon)
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
