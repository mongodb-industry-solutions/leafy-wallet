# Demo Template Style Guide

This web app is built with Next.js 15 (App Router) and JavaScript.
Keep the code clean, simple, and efficient.
Follow general coding best practices.

## Project structure

The folder structure aims to maintain separation of concerns, keeping the code clean, organized, and simple.

- `public/` — Static assets accessible on the web (images, PDFs, etc.).
- `src/` — Main source code.
- `src/app/` — App Router pages and API routes.
- `src/app/api/` — API routes live here; Caution do not expose endpoints with destructive actions, use server actions instead.
- `src/app/page.js` — The main page of the app.
- `src/components/` — Each component has its own subfolder.
- `src/components/<ComponentName>/ComponentName.js` — UI‑focused component (JSX + Tailwind CSS). Keep react logic in hooks.
- `src/components/<ComponentName>/useComponentName.js` — Component-specific hooks. React logic for non-reusable hooks lives here.
- `src/integrations/` — Integrations with external systems (e.g., databases).
- `src/lib/` — General reusable logic (e.g., complex functions).
- `src/lib/db/` — Functions called by components to perform database CRUD operations; abstract calls to server actions or API routes to keep components concise.
- `src/lib/hooks/` — Optional. Reusable hooks used across components.

## UI

The primary UI library is LeafyGreen (leafygreen-ui).
Use components from this library as needed to build the requested UI.

For a detailed guide on how to use leafygreen-ui check [LEAFYGREEN-UI-GUIDE.md](./LEAFYGREEN-UI-GUIDE.md).

## Palette

The palette should align with MongoDB brand guidelines.

For details on how to use the palette, see [PALETTE-GUIDE.md](./PALETTE-GUIDE.md).

## Coding style

More specific good practices and coding preferences are described in [JAVASCRIP-GUIDE.md](./JAVASCRIP-GUIDE.md).
