/** What lives in the ocean tank, with each kind's scientific name, as on a natural history plate. */
export const SPECIES = [
  { name: 'WHALE SHARK', latin: 'Rhincodon typus' },
  { name: 'GREAT HAMMERHEAD', latin: 'Sphyrna mokarran' },
  { name: 'BOTTLENOSE DOLPHIN', latin: 'Tursiops truncatus' },
  { name: 'MANTA RAY', latin: 'Mobula birostris' },
  { name: 'GREEN SEA TURTLE', latin: 'Chelonia mydas' },
]

/**
 * The ocean tank's page: nothing to read but a small label in the corner, as beside a tank in an
 * aquarium, naming what lives in it. The rest of the screen is left to the water.
 */
export function OceanLabel() {
  return (
    <section className="relative h-dvh">
      <h1 className="sr-only">Ocean</h1>
      {/* The whole label counts as text for the water, so nothing swims through its box. */}
      <div
        data-water-text-box
        className="absolute bottom-6 left-4 border border-current/40 px-4 py-3 text-[10px] tracking-[0.2em] sm:left-6"
      >
        <p className="flex items-center gap-2 opacity-(--jelly-faint)">
          <span className="grid size-4 place-items-center rounded-full border border-current text-[9px] tracking-normal">
            4
          </span>
          OCEAN
        </p>
        <ul className="mt-3 space-y-1.5">
          {SPECIES.map((species) => (
            <li
              key={species.name}
              className="flex flex-col sm:flex-row sm:gap-3"
            >
              <span>{species.name}</span>
              <span className="tracking-[0.05em] italic opacity-(--jelly-faint)">
                {species.latin}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
