// Test stub for the `server-only` package.
//
// The real `server-only` package throws on import unless the bundler resolves it
// with React's `react-server` export condition (which Next.js applies to the
// server bundle). Vitest does not apply that condition, so importing any module
// marked `import "server-only"` would throw at collection time. Vitest aliases
// `server-only` to this empty module (see vitest.config.ts) so server modules —
// e.g. src/env.server.ts, src/lib/db/client.ts, src/services/customers.db.ts —
// can be imported and unit-tested. The server/client boundary is still enforced
// by the real package in `next build`.
export {};
