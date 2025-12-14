import { createFileRoute } from '@tanstack/react-router'

import { listPokemon } from '@/server/pokemon'

export const Route = createFileRoute('/')({
  loader: () => listPokemon(),
  component: Pokedex,
})

function Pokedex() {
  const pokemon = Route.useLoaderData() ?? []

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
            and reliable.
          </p>
        </header>

        {pokemon.length === 0 ? (
          <div className="text-center text-gray-400">
            <p>No Pokémon yet. Try refreshing.</p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pokemon.map((mon) => (
              <li
                key={mon.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/30 backdrop-blur"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={mon.spriteUrl}
                    alt={mon.name}
                    width={72}
                    height={72}
                    className="h-16 w-16 object-contain drop-shadow-[0_4px_12px_rgba(59,130,246,0.45)]"
                  />
                  <div>
                    <p className="text-xs uppercase tracking-widest text-gray-400">
                      #{String(mon.id).padStart(3, '0')}
                    </p>
                    <h2 className="text-xl font-semibold capitalize">
                      {mon.name}
                    </h2>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
