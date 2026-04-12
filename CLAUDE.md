# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (see `pnpm-workspace.yaml`, `pnpm-lock.yaml`).

- `pnpm dev` — Next.js dev server with Turbopack
- `pnpm build` — production build
- `pnpm start` — run the production build
- `pnpm lint` — ESLint (`eslint-config-next`)
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm format` — Prettier over `**/*.{ts,tsx}`

No test runner is configured.

## Architecture

FlightDash is a single-page Next.js 16 (App Router, React 19) aircraft tracker that polls a public ADS-B feed and renders results on a MapLibre map. The entire UI lives in `app/page.tsx`; there is no routing or state library.

**Data flow:**
1. `app/api/aircraft/route.ts` is the only API route. It fetches `https://api.adsb.lol/v2/lat/{HOME_LAT}/lon/{HOME_LON}/dist/200` (hardcoded to Victorville, CA — 200-mile radius), normalizes the raw ADS-B payload, computes haversine distance from the home coordinate, and tags aircraft as military via three heuristics: callsign prefix, ICAO hex prefix (`AE`/`AF`/`B1`/`B2`), and known type codes. Response is revalidated every 10s (`next: { revalidate: 10 }`). If you change the home location, update both `HOME_LAT`/`HOME_LON` and the hardcoded center fallback in `app/page.tsx`.
2. `app/page.tsx` polls `/api/aircraft` every 10s, filters client-side (military toggle), and renders a split list/map layout. On mobile (`<lg`), a tab toggle switches between list and map; selecting an aircraft from the list auto-switches to the map view.

**Map component (`components/map.tsx`):**

A small mapcn-style wrapper around MapLibre GL JS exposing `<Map>`, `<Marker>`, `<Popup>`, and a `useMap()` hook backed by React Context. Key invariants — **break these and things regress badly**:

- The map instance is mirrored from a ref into `useState` so context consumers re-render once the map is ready. Reading `mapRef.current` during render gives stale context.
- Initial `center`/`zoom` are captured into refs and the init `useEffect` has an empty dep array — initialization must run exactly **once** per mount. Later `center`/`zoom` prop changes are applied via separate effects calling `setCenter`/`setZoom`.
- Children are only rendered after the `load` event fires (`mounted && children`), so `<Marker>`/`<Popup>` can safely touch `document` and assume `map` is non-null.
- A `ResizeObserver`-style `IntersectionObserver` calls `map.resize()` when the container becomes visible. This exists because MapLibre mis-measures hidden containers — which is why `app/page.tsx` also passes `key={`map-${mobileView}`}` to force a full remount when the mobile tab switches. Removing either mechanism breaks mobile map rendering (see commits `a731425`, `4bdf7bd`, `e586475`).
- `<Popup>` lazily creates its DOM container in `useState(() => ...)` and renders children via `createPortal`; do not move the `document.createElement` call into an effect without preserving this pattern.

## Conventions

- Path aliases: `@/components`, `@/lib`, `@/hooks`, `@/components/ui` (see `components.json`, `tsconfig.json`).
- shadcn/ui is configured (`style: radix-vega`, `baseColor: taupe`, icon library `phosphor`). Add components with `npx shadcn@latest add <name>` — they land in `components/ui`.
- Styling: Tailwind v4 via `@tailwindcss/postcss`, theme tokens in `app/globals.css`, dark mode via `next-themes`. Use `cn()` from `@/lib/utils` for class merging.
- TypeScript is strict; the `Aircraft` interface is duplicated between `app/api/aircraft/route.ts` and `app/page.tsx` — keep them in sync when editing either side.
