# Frontend Architect — Project Memory

## Project: retail-erp/website

### Stack
- Framework: React 18 + TypeScript + Vite
- Routing: react-router-dom v6 (BrowserRouter, nested routes)
- Styling: Plain CSS files co-located with components; shared/base styles in `src/App.css`
- No CSS Modules, no Tailwind, no styled-components
- Fonts: DM Sans (body) + Fraunces (brand/logo) via Google Fonts in index.html

### Design tokens (defined in `src/App.css` :root) — Dr Morepen Pharmacy brand
- Primary navy: `#1a2e5a` (--primary), dark `#0f1e3d` (--primary-dark), light `#dde4f0` (--primary-light), subtle `#f0f3f9` (--primary-subtle)
- Accent orange: `#f97316` (--accent), dark `#ea6c0a` (--accent-dark), light `#fff7ed` (--accent-light)
- Border focus: `#f97316` (orange focus ring on form inputs)
- Text: primary `#1e293b`, secondary `#475569`, muted `#94a3b8`
- Border: `#e2e8f0`; body bg: `#f0f2f5`
- Nav height: 60px (--nav-height); Tab bar height: 64px (--tab-height)
- Breakpoint for mobile/desktop split: 768px (`.desktop-only` / `.mobile-only`)

### Brand color intent
- Navy (`--primary`) = dominant color; navbar bg, ghost button, approved badge, type-tag, role-admin pill, login icon bg, brand name
- Orange (`--accent`) = action/CTA; btn-primary, active nav links, active tab icons, cross icon, focus rings, spinner arc
- Destructive (reject, cancel, deactivate) = red `btn-danger` — unchanged
- Semantic badges kept: active/completed = green, rejected = red, inactive/cancelled = grey, pending/scheduled = orange-amber

### Button semantics (color consistency)
- `btn-primary` (orange) = positive CTAs: Approve, Activate (stores/users), Complete (visits), Login submit
- `btn-ghost` (navy border/text) = neutral: Resubmit, Retry
- `btn-danger` (red) = destructive: Reject, Cancel, Deactivate

### Key conventions
- Shared utility classes (`.btn`, `.result-box`, `.error`, `.meta`, `.badge`, `.badge-*`, `.form-group`, `.form-input`, `.table-wrap`, `.data-table`, `.card-list`, `.data-card`, `.state-box`, `.page`, `.page-header`) live in `src/App.css`
- Component-specific styles go in a same-name `.css` file imported directly by the component
- Component files use named exports (e.g., `export function Stores`)
- `isMobile` is detected at module level via `window.matchMedia('(pointer: coarse)')`

### Routing architecture (`src/App.tsx`)
- BrowserRouter at root
- `/` → `RootRedirect` (checks `authService.isAuthenticated()`)
- `/login` → `<Login />` (no layout, no auth guard)
- `/stores`, `/users`, `/visits` → nested under `<ProtectedRoute>` → `<Layout>` (Outlet)
- Catch-all `*` → redirects to `/`

### Auth pattern
- `authService` in `src/services/auth.service.ts` — login/logout/isAuthenticated (token in localStorage)
- `ApiError` from `src/services/api.ts` — always catch with `instanceof ApiError` for structured messages
- `ProtectedRoute` at `src/components/ProtectedRoute.tsx` — uses `<Navigate to="/login" replace />` if not authenticated

### Layout (`src/components/Layout.tsx` + `Layout.css`)
- Collapsible left sidebar (replaces the old top navbar + mobile bottom tab bar)
- Sidebar bg: var(--primary) navy; active link orange tint; active svg stroke #f97316
- Desktop expanded: 220px (`--sidebar-width`); desktop collapsed: 60px (`--sidebar-collapsed-width`) — icon-only, labels hidden, icons centered
- Mobile: compact white topbar (52px, `--mobile-topbar-height`) with hamburger + logo; sidebar slides in as overlay (260px, z-index 200) with dark backdrop
- State: `sidebarOpen` (mobile overlay open/close), `sidebarExpanded` (desktop expand/collapse)
- `.app-shell` gets class `sidebar-expanded` or `sidebar-collapsed` for CSS-driven width changes
- `useEffect` on `location.pathname` closes mobile sidebar on route change
- `.sidebar-close-btn` visible mobile only; `.sidebar-toggle-btn` visible desktop only (via media query)
- `.page-content` uses `margin-left` on desktop (transitions with sidebar width), `margin-top` on mobile for topbar; `!important` on mobile to override desktop rules
- New CSS vars in Layout.css: `--sidebar-width: 220px`, `--sidebar-collapsed-width: 60px`, `--mobile-topbar-height: 52px`
- `--nav-height` and `--tab-height` still in App.css :root (unused by layout now, kept for backward compat)

### Pages (`src/pages/`)
- `Login.tsx` + `Login.css` — centered card, brand block, email+password form, spinner on submit
- `Stores.tsx` + `Stores.css` — fetches stores+users in parallel (Promise.all); status badges; per-row actions per StoreStatus; UserChips (max 2 + "+N more"); Users button opens AssignModal
- `Users.tsx` + `Users.css` — fetches users+stores in parallel (Promise.all); role pills; Activate/Deactivate toggle; StoreChips (max 2 + "+N more"); Stores button opens AssignModal
- `Visits.tsx` + `Visits.css` — visitsService.getAll(), Complete/Cancel only on scheduled visits, date formatted via toLocaleDateString('en-IN')

### Page layout pattern (all 3 data pages)
- `loading` state → centered spinner in `.state-box`
- `error` state → retry button in `.state-box`
- Empty list → icon + text in `.state-box`
- Data loaded → `.table-wrap > .data-table` on desktop (`.desktop-only`), `.card-list > .data-card` on mobile (`.mobile-only`)
- Action errors shown in `.error` div above the table
- `busyId` state tracks which row has an in-flight action (disables buttons for that row)

### Services (READ ONLY — never modify)
- `src/services/api.ts` — `ApiError`, `tokenStorage`, `api.get/post/patch/put/delete`
- `src/services/auth.service.ts` — `authService.login/logout/isAuthenticated`
- `src/services/stores.service.ts` — `storesService`, `Store`, `StoreStatus`, `StoreType`; Store has NO users field
- `src/services/users.service.ts` — `usersService`, `User`, `UserRole`, `UserStatus`; User.stores: string[] (array of store _ids)
- `src/services/visits.service.ts` — `visitsService`, `Visit`, `VisitStatus`
- Store→user linkage is derived: `users.filter(u => u.stores.includes(storeId))`
- All assign/remove mutations go through usersService: `assignStores(userId, storeIds[])` / `removeStores(userId, storeIds[])`

### Component: AssignModal (`src/components/AssignModal.tsx` + `AssignModal.css`)
- Generic bidirectional linking modal; props: title, allItems, assignedIds, busy, onAssign, onRemove, onClose
- Closes on Escape, backdrop click, or close button; locks body scroll while open
- Focuses search input on mount; search filters both Assigned and Available sections by label + sublabel
- Tracks per-item busy state internally (busyItem) and shows inline spinner in action button
- Two sections: "Assigned (N)" with remove (×) buttons; "Available (N)" with add (+) buttons
- Mobile: slides up from bottom (border-radius 14px 14px 0 0, max-height 88vh, full width)
- Desktop: centered card, max-width 480px

### Chip CSS pattern (Users.css + Stores.css — identical copy in each)
- `.cell-chips` — flex row in table td, holds chip group + action button side by side
- `.assign-chips` — flex wrap row of chips
- `.assign-chip` — navy bg (#dde4f0), navy text (#1a2e5a), 0.72rem, border-radius 4px, max-width 120px ellipsis
- `.assign-chip--more` — slate bg/text for "+N more" overflow chip
- `.assign-chips-empty` — italic muted "None" placeholder
- `.data-card-row--chips` — modifier on `.data-card-row`; right-aligns chip group for mobile cards

### Component: CameraCapture (`src/components/CameraCapture.tsx` + `CameraCapture.css`)
- Props: `fileUpload?: boolean`, `onCapture?: (image: CapturedImage) => void`
- `fileUpload=false` (default): getUserMedia camera-only flow
- `fileUpload=true`: shows both "Upload Image" (file picker) and "Take Photo" (camera) side by side

### Component: SignaturePad (`src/components/SignaturePad.tsx` + `SignaturePad.css`)
- Props: `onCapture?: (sig: CapturedSignature) => void`
- Canvas drawing uses refs (`isDrawing`, `lastPoint`) — not state — to avoid re-renders

### Overflow/scroll fix patterns (applied Feb 2026)
- `index.css` body had `display: flex; place-items: center` (Vite scaffold default) — removed; turns body into a centered flex container causing layout failures
- `html` and `body` both get `overflow-x: hidden` in App.css
- `.app-shell` gets `overflow-x: hidden; max-width: 100vw` to contain sidebar slide-in on mobile
- `.table-wrap` uses `overflow-x: auto; overflow-y: hidden` (not `overflow: hidden`) so tables scroll within their card, not the page
- `.page` gets `width: 100%; box-sizing: border-box` alongside `max-width: 1200px`
- `.card-list` and `.data-card` get `max-width: 100%; min-width: 0`; `.data-card` also gets `overflow: hidden`
- `.data-card-row` gets `min-width: 0` so flex children can shrink below content size
- `.data-card-value` gets `min-width: 0; word-break: break-word`
- `.data-card-meta` gets `word-break: break-all; overflow-wrap: anywhere` for long emails/IDs
- `.page-header` gets `min-width: 0`
- `.cell-chips` in both Stores.css and Users.css gets `min-width: 0`
- `.cell-email` in Users.css gets `max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`

### Notes
- Agent threads always have their cwd reset between bash calls — only use absolute file paths
- In final responses, always share relevant file names and code snippets with absolute paths
- Do not use emojis in responses
- Do not use a colon before tool calls
