import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const standardUser: AuthenticatedUser = {
  id: 1,
  openId: "standard-user",
  email: "user@example.com",
  name: "Standard User",
  loginMethod: "manus",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("customers.lookup", () => {
  it("rejects unauthenticated callers", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.customers.lookup({ phone: "0400000000" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects non-admin callers", async () => {
    const caller = appRouter.createCaller(createContext(standardUser));

    await expect(caller.customers.lookup({ phone: "0400000000" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
