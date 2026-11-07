import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { createTestDb, migrateTestDb, resetTables } from "../test/helpers";
import {
  createSession,
  findSession,
  hasAdminGroup,
  revokeSession,
  sessionInputFromClaims,
} from "./session";

const db = createTestDb();

beforeAll(async () => {
  await migrateTestDb(db);
});
afterAll(async () => {
  await db.$client.end();
});
beforeEach(async () => {
  await resetTables(db);
});

describe("sessions", () => {
  test("stores a session and reads it back", async () => {
    const created = await createSession({
      email: "dasa@dasa122.net",
      groups: ["dasa122.net-admin"],
      name: "Dasa",
      subject: "user-1",
    });
    const found = await findSession(created.id);
    expect(found?.subject).toBe("user-1");
    expect(found?.groups).toEqual(["dasa122.net-admin"]);
  });

  test("returns null for an expired session", async () => {
    const created = await createSession(
      { email: null, groups: [], name: null, subject: "u" },
      -1,
    );
    expect(await findSession(created.id)).toBeNull();
  });

  test("revoking removes the session", async () => {
    const created = await createSession({
      email: null,
      groups: [],
      name: null,
      subject: "u",
    });
    await revokeSession(created.id);
    expect(await findSession(created.id)).toBeNull();
  });

  test("the admin group check is an exact match", () => {
    const session = {
      email: null,
      expiresAt: new Date(),
      groups: ["dasa122.net-admin"],
      id: "x",
      name: null,
      subject: "u",
    };
    expect(hasAdminGroup(session, "dasa122.net-admin")).toBe(true);
    expect(
      hasAdminGroup(
        { ...session, groups: ["dasa122.net-admin-extra"] },
        "dasa122.net-admin",
      ),
    ).toBe(false);
    expect(
      hasAdminGroup(
        { ...session, groups: ["DASA122.NET-ADMIN"] },
        "dasa122.net-admin",
      ),
    ).toBe(false);
    expect(hasAdminGroup(null, "dasa122.net-admin")).toBe(false);
  });
});

describe("sessionInputFromClaims", () => {
  test("a string-valued groups claim never grants admin", () => {
    const input = sessionInputFromClaims({
      groups: "dasa122.net-admin",
      sub: "user-1",
    });
    expect(input.groups).toEqual([]);
    expect(
      hasAdminGroup(
        { ...input, expiresAt: new Date(), id: "x" },
        "dasa122.net-admin",
      ),
    ).toBe(false);
  });

  test("non-string group entries are filtered out", () => {
    const input = sessionInputFromClaims({
      groups: ["dasa122.net-admin", 42, null],
      sub: "user-1",
    });
    expect(input.groups).toEqual(["dasa122.net-admin"]);
  });

  test("guards email and name to strings or null", () => {
    const input = sessionInputFromClaims({
      email: 42,
      groups: [],
      name: { first: "Dasa" },
      sub: "user-1",
    });
    expect(input.email).toBeNull();
    expect(input.name).toBeNull();
  });
});
