// @vitest-environment node
import { createServer, type Server, type Socket } from "node:net";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { connectDatabase, type DatabaseConnection } from "@/lib/db/connect";
import { DatabaseUnreachableError } from "@/lib/db/errors";

// A database that takes the connection and never answers must fail the
// Website's read quickly, with a clear error that names no host, instead of
// hanging the page. Here a socket that accepts and stays silent stands in for
// it, and the client waits 1 second instead of CONNECT_TIMEOUT_SECONDS.

const silent = vi.hoisted(() => ({ connection: undefined as DatabaseConnection | undefined }));

vi.mock("@/lib/db/client", () => ({
  getDb: () => {
    if (!silent.connection) throw new Error("the silent database isn't set up");
    return silent.connection.db;
  },
}));

let server: Server;
const sockets: Socket[] = [];

beforeAll(async () => {
  server = createServer((socket) => sockets.push(socket));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  silent.connection = connectDatabase(
    `postgresql://postgres:s3cret@127.0.0.1:${address.port}/postgres`,
    { connectTimeoutSeconds: 1 },
  );
});

afterAll(async () => {
  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => server.close(resolve));
  await silent.connection?.close();
});

describe("catalogue seam, database arm: an unreachable database", () => {
  it("fails a read within the connect timeout, saying the database didn't answer", async () => {
    const seam = await import("./catalogue.db");
    const started = Date.now();
    const read = seam.listExams();

    await expect(read).rejects.toBeInstanceOf(DatabaseUnreachableError);
    await expect(read).rejects.toThrow(
      "The database didn't answer (CONNECT_TIMEOUT). Check that it is running and that DATABASE_URL points at it.",
    );
    // Well inside the test's 5 s limit: one connect timeout, not a hang.
    expect(Date.now() - started).toBeLessThan(4000);
    expect(sockets.length).toBeGreaterThan(0);
  });

  it("names no host, port or password in the error", async () => {
    const seam = await import("./catalogue.db");
    const error = await seam.getWebsiteSettings().catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(DatabaseUnreachableError);
    expect(String(error)).not.toMatch(/127\.0\.0\.1|s3cret|postgresql:/);
  });
});
