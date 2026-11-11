// import { Link } from '@tanstack/react-router'
//
// import { useAtlas } from './atlas-context'
import { ScrambleText } from './scramble-text'

/**
 * The contents page while the works are not ready yet: a short notice set like the 404 page.
 * The table of plates is kept commented out below, to bring back once the works are filled in.
 */
export function ContentsList() {
  return (
    <section className="flex h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="pl-[0.3em] text-xs tracking-[0.3em] uppercase opacity-(--jelly-faint)">
        Works
      </p>
      <h1 className="mt-6 pl-[0.25em] text-3xl font-semibold tracking-[0.25em] uppercase sm:text-5xl">
        <ScrambleText text="Coming soon" settleOnMount />
      </h1>
    </section>
  )
}

// /** Dots between a plate's title and its year, cut to the space between them. */
// const LEADER = '. '.repeat(120)
//
// /**
//  * The table of plates, set like the contents page of an old book: numeral, title and year joined
//  * by dots. Each work gets a large entry: its picture on one side (above on narrow screens), and
//  * beside it the one-line summary, the role and the tools, and the start of its description, so
//  * every work can be judged without opening it. Opening a plate sends its picture out on a ripple
//  * from the line that was clicked.
//  */
// export function ContentsList() {
//   const { atlas, rippleFrom } = useAtlas()
//   return (
//     <section className="mx-auto w-full max-w-5xl px-4 pt-24 pb-24 sm:px-6">
//       <ol className="space-y-14 md:space-y-16">
//         {atlas.plates.map((plate) => (
//           <li key={plate.slug}>
//             <Link
//               to="/plates/$slug"
//               params={{ slug: plate.slug }}
//               onClick={rippleFrom}
//               className="group grid grid-cols-1 gap-x-10 gap-y-5 md:grid-cols-2 md:items-start"
//             >
//               {/* The water goes faint around the picture, as it does around text. */}
//               <span
//                 data-water-text-box
//                 className="block aspect-3/2 overflow-hidden border border-current/15"
//               >
//                 <img
//                   src={plate.image}
//                   alt=""
//                   loading="lazy"
//                   decoding="async"
//                   className="size-full object-cover object-top"
//                 />
//               </span>
//               <span className="block md:pt-1">
//                 <span className="flex items-baseline gap-3 text-sm">
//                   <span className="w-12 shrink-0 text-right tracking-[0.2em] opacity-(--jelly-faint)">
//                     {plate.numeral}.
//                   </span>
//                   <span className="font-semibold group-hover:underline">
//                     {plate.title}
//                   </span>
//                   {/* The whole box counts as text for the water: the dots run on past it, hidden. */}
//                   <span
//                     aria-hidden="true"
//                     data-water-text-box
//                     className="min-w-6 flex-1 overflow-hidden whitespace-nowrap opacity-30"
//                   >
//                     {LEADER}
//                   </span>
//                   <span className="shrink-0 opacity-(--jelly-faint)">
//                     {plate.year}
//                   </span>
//                 </span>
//                 <span className="mt-2 block pl-15 text-[13px] opacity-(--jelly-soft)">
//                   {plate.summary}
//                 </span>
//                 <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 pl-15 text-xs">
//                   <dt className="opacity-(--jelly-faint)">role</dt>
//                   <dd className="opacity-(--jelly-soft)">{plate.role}</dd>
//                   <dt className="opacity-(--jelly-faint)">tools</dt>
//                   <dd className="opacity-(--jelly-soft)">{plate.tools}</dd>
//                 </dl>
//                 {/* Cut to three lines. Counted as one box, so the water fades only behind the lines shown. */}
//                 <span
//                   data-water-text-box
//                   className="mt-4 ml-15 line-clamp-3 text-xs leading-6 opacity-(--jelly-faint)"
//                 >
//                   {plate.lead}
//                 </span>
//               </span>
//             </Link>
//           </li>
//         ))}
//       </ol>
//     </section>
//   )
// }
