---
name: data-tables
description: Use when building or changing a data table — TanStack Table (@tanstack/react-table) column defs, row models, filtering, pagination, sorting, rendered with the shadcn Table primitives.
---

# Data tables (this repo)

## 1. When to use

Any tabular UI: a new table, columns, filtering, pagination, or sorting. Pair
with **shadcn-ui** (the `Table` primitives you render into) and the service seam
(**drizzle-data**) for the data you pass in.

## 2. Version

- `@tanstack/react-table` **8.21.3** (from `package.json` / installed).

## 3. Core standards

**TanStack Table is headless.** It owns state and logic; YOU render the markup —
here with the shadcn `Table` primitives. Nothing is styled or rendered for you.

**Shape:** `useReactTable({ data, columns, getCoreRowModel(), … })` returns a
table instance. `columns` is a `ColumnDef<T>[]` (`accessorKey`/`header`/`cell`/
`id`). Render header and cell templates with **`flexRender`**.

**Row models are opt-in — import only what you use:** `getCoreRowModel`
(required), `getFilteredRowModel` (filtering), `getPaginationRowModel`
(pagination), `getSortedRowModel` (sorting).

**Control state** you drive from the UI with `state` + `onXChange` (e.g.
`state: { globalFilter }`, `onGlobalFilterChange`).

**Keep `data` and `columns` referentially stable** — define `columns` at module
scope (or memoize) and pass stable `data`; unstable references cause needless
re-renders or update loops.

## 4. In this template

- `src/components/dashboard/customer/customers-table.tsx` — `"use client"`
  reference table: `useReactTable` with core + filtered + pagination row models, a
  **controlled `globalFilter`** bound to a shadcn `Input`, `flexRender` for
  headers/cells, shadcn `Table` markup, an empty state ("No customers found."),
  and Previous/Next buttons gated by `getCanPreviousPage`/`getCanNextPage`.
- `src/components/dashboard/customer/columns.tsx` — `ColumnDef<Customer>[]`
  defined at module scope: `accessorKey` columns plus custom `cell` renderers
  (`StatusBadge`, a `dayjs`-formatted date, and an actions `DropdownMenu` linking
  to the detail route via `paths`).
- Data flows in from the RSC page through the seam (`listCustomers`), passed as
  the `data` prop — the table never fetches.

## 5. Red flags

- Expecting the library to render markup — it's headless; render with shadcn
  `Table` + `flexRender`.
- Defining `columns`/`data` inline in the component body each render (unstable
  refs → perf issues / update loops) — define at module scope like `columns.tsx`.
- Forgetting `getCoreRowModel()` or the row model for a feature you use
  (filter/paginate/sort).
- Fetching inside the table instead of receiving seam data via props.
- Building a bespoke `<table>` instead of reusing the CustomersTable pattern.

## 6. Sources

- TanStack Table docs — https://tanstack.com/table/latest/docs/introduction
- React adapter (`useReactTable`) — https://tanstack.com/table/latest/docs/framework/react/react-table
- Column defs — https://tanstack.com/table/latest/docs/guide/column-defs
- Row models — https://tanstack.com/table/latest/docs/guide/row-models
