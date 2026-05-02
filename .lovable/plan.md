# Local-First Body Tracking App — MVP Plan v2.1

A single-user, fully client-side body tracking app. All data lives in the browser via IndexedDB (Dexie). No backend, no auth, no cloud. UI never touches Dexie directly — it goes through a service layer so storage can later be swapped without rewriting screens.

Changes vs v2: explicit Dexie import-rule exception for hooks, UI calls hooks (not persistence functions), `reverse().first()` for "latest", simpler read-error guidance.

## Revised Architecture Summary

- Dexie is the single source of truth. No caching layer sits in front of it.
- No TanStack Query. Removed from tech choices, providers, and hooks.
- Reactivity comes from Dexie `liveQuery`, consumed in React via `dexie-react-hooks`' `useLiveQuery`. This is wired inside custom hooks only.
- **Exception to the Dexie import rule:** hooks may import `dexie-react-hooks` only, but must not import `db`, Dexie instances, or perform direct queries. All queries still go through service functions.
- Service layer remains the only persistence API. `liveQuery` callbacks inside hooks call service read functions — components never import `liveQuery`, Dexie, or `db`.
- No global state library. Local component state plus Dexie-backed hooks cover all needs. Settings/profile read via dedicated hooks that also use `liveQuery` so unit toggles propagate instantly.
- Analysis stays pure. `analysisService` takes plain inputs and returns results; no storage, no hooks.

## App Structure

```text
src/
  db/
    db.ts                      Dexie schema + typed tables
  services/                    only files allowed to import Dexie / db
    checkinService.ts
    measurementService.ts
    measurementTypeService.ts
    photoService.ts
    profileService.ts
    settingsService.ts
    analysisService.ts         pure
    exportImportService.ts
  lib/
    units.ts
    validation.ts
    format.ts
    ids.ts
  hooks/                       thin; each uses useLiveQuery internally and
                               calls only service-layer read functions
    useCheckins.ts             list, latest, byId   (+ action hooks for writes)
    useMeasurements.ts         history per type, latest+previous (+ actions)
    useMeasurementTypes.ts     active types, all types (+ actions)
    usePhotos.ts               list, byCheckin, byPoseTag (+ actions)
    useProfile.ts              read + update action
    useSettings.ts             read + update action
    useAnalysisInputs.ts       composes latest checkin + profile (live)
    useAction.ts               generic { run, isSubmitting, error } helper
  components/                  unchanged from approved plan
  pages/                       unchanged
  App.tsx                      routes only — no QueryClientProvider
```

Removed: `QueryClientProvider`, `QueryClient`, all `useQuery` / `useMutation`.

## Hook Pattern (replaces TanStack Query)

Each hook wraps a service-layer read with `useLiveQuery` and exposes a small, predictable shape. Writes are also wrapped in feature-specific action hooks so UI never imports persistence functions directly.

```ts
// hooks/useCheckins.ts
import { useLiveQuery } from "dexie-react-hooks";
import * as checkinService from "@/services/checkinService";
import { useAction } from "@/hooks/useAction";

export function useRecentCheckins(limit = 20) {
  const data = useLiveQuery(() => checkinService.listRecent(limit), [limit]);
  return { data: data ?? [], isLoading: data === undefined };
}

export function useLatestCheckin() {
  const data = useLiveQuery(() => checkinService.getLatest(), []);
  return { data: data ?? null, isLoading: data === undefined };
}

// Write actions — UI calls these, not the service directly
export const useCreateCheckin = () => useAction(checkinService.createCheckin);
export const useUpdateCheckin = () => useAction(checkinService.updateCheckin);
export const useDeleteCheckin = () => useAction(checkinService.deleteCheckin);
```

Service reads (observed by `liveQuery`):

```ts
// services/checkinService.ts
import { db } from "@/db/db";
export const listRecent = (limit: number) =>
  db.checkins.orderBy("recordedAt").reverse().limit(limit).toArray();
export const getLatest = () =>
  db.checkins.orderBy("recordedAt").reverse().first();
```

UI rule (strict):

- Pages/components never import `db`, Dexie, or `liveQuery`.
- Pages/components do not import service modules for writes either — they call feature action hooks (`useCreateCheckin`, etc.) or screen-local action handlers built on top of those hooks.
- This keeps the boundary clean and prevents persistence calls from drifting across the tree.

Generic write helper (the only generic abstraction introduced — replaces `useMutation`):

```ts
// hooks/useAction.ts
export function useAction<T extends (...a: any[]) => Promise<any>>(fn: T) {
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const run = useCallback(async (...args: Parameters<T>) => {
    setSubmitting(true); setError(null);
    try { return await fn(...args); }
    catch (e) { setError(e as Error); throw e; }
    finally { setSubmitting(false); }
  }, [fn]);
  return { run, isSubmitting, error };
}
```

## Dependency Changes

- Remove: `@tanstack/react-query` (and provider import in `App.tsx`).
- Add: `dexie`, `dexie-react-hooks`.
- Add (unchanged from prior plan): `browser-image-compression`, `recharts`.
- No global state library. No data-fetching framework.

## Implementation Notes

- Cache invalidation is gone. Dexie writes automatically retrigger every `useLiveQuery` whose query touches the changed table — no `queryKey`s to maintain.
- Loading state convention: `useLiveQuery` returns `undefined` until first resolve. Hooks normalize that to `{ data, isLoading }` so components don't branch on `undefined`.
- **Read errors:** Do not rely on thrown read errors for normal UI flow. Treat IndexedDB read failures as exceptional app-level storage errors surfaced through a screen-level `ErrorState` component (e.g. via an error boundary or a one-time storage health check on app boot). Keep hooks simple: return `{ data, isLoading }` for normal reads unless a specific query genuinely needs structured error output.
- Writes use local state via `useAction` — no mutation cache, no optimistic update plumbing for MVP.
- Settings/units reactivity: `useSettings()` is `liveQuery`-backed, so toggling kg↔lb or cm↔in updates every screen instantly without prop drilling or context.
- Import flow: `exportImportService.importAll` runs in a single Dexie transaction. When it commits, every live hook refreshes automatically — no manual cache reset.
- Analysis screen: `useAnalysisInputs` composes `getLatest()` + `getProfile()` + latest measurements via a single `liveQuery` callback (multiple awaits inside one callback are fine — Dexie tracks all touched tables). The result is fed to pure `analysisService` functions.
- `App.tsx`: strips `QueryClient` / `QueryClientProvider`; keeps `BrowserRouter`, `TooltipProvider`, toasters.
- Testing: services tested with `fake-indexeddb`; hooks need only React Testing Library — no query client setup.

## Unchanged from Approved Plan

- All 6 screens, behaviors, validation rules, canonical-unit storage, photo compression and object-URL discipline, export/import JSON shape, accessibility and mobile-first rules, performance rules, and the explicit "do not build" list are unchanged.
- The architectural rule that only `src/db/*` and `src/services/*` may import Dexie is preserved, with the single explicit exception that hooks may import `dexie-react-hooks` (but never `db` or Dexie itself).

## Build Order

1. Dexie schema + first-run seeding + service layer
2. Settings + Profile (hooks + screen)
3. Check-in create/edit + Home overview
4. Measurements screen + chart
5. Photos screen + compression + comparison
6. Analysis screen
7. Export / Import
8. Polish: empty/error/loading states, a11y, mobile nav
