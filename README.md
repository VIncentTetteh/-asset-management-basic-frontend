# AssetIQ — Web App

The web client for **AssetIQ**, an enterprise asset management platform (assets, checkouts, transfers, maintenance, procurement & finance, compliance, DPA, AI insights) with multi-tenant SaaS and self-hosted (standalone) modes.

Part of the AssetIQ platform:

| Surface | Repo |
|---|---|
| Backend API (Spring Boot) | `Enterprise-Asset-Manager` |
| **Web app (this repo)** | `Enterprise-Asset-manager-Frontend` |
| Desktop app (Electron) | `Enterprise-Asset-manager-desktop-app` |
| Mobile app (Expo) | `Enterprise-Asset-Mobile` |

## Stack

- Next.js (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4, Radix-based UI kit in `src/components/ui/`
- Axios with HttpOnly-cookie auth; all browser `/api/*` calls are forwarded by the server-side proxy at `src/app/api/[...path]/route.ts`

## Getting started

```bash
npm ci
cp .env.example .env.local   # set API_TARGET_BASE to your backend, e.g. http://localhost:8085/api
npm run dev                  # http://localhost:3000
```

The backend must be running (see the backend repo's README). Auth uses an HttpOnly `access_token` cookie set by the backend — no tokens in localStorage.

## Environment

| Variable | Scope | Purpose |
|---|---|---|
| `API_TARGET_BASE` | server-only | Backend base URL the proxy forwards to (must end in `/api`) |
| `NEXT_PUBLIC_APP_MODE` | public | `cloud` (SaaS) or `standalone` (self-hosted, license gating active) |

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

## Structure

- `src/app/` — ~63 routes (assets, checkouts, transfers, maintenance, finance, 13 compliance pages, DPA, admin, billing, AI)
- `src/services/` — one API service module per backend domain
- `src/contexts/` — Auth, Permission, Currency, License contexts
- `src/components/` — UI kit, layout, RBAC gates (`Can`, `PermissionGate`, `ProtectedRoute`)
- `docs/` — UI/UX blueprint and design tokens
