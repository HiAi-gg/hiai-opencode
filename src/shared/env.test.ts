import { describe, expect, test } from "bun:test";
import { resolveEnvVars } from "./env";

describe("resolveEnvVars — string replacement", () => {
  test("replaces a single {env:VAR} token", () => {
    process.env.BOB_TEST_FOO = "bar";
    expect(resolveEnvVars("{env:BOB_TEST_FOO}")).toBe("bar");
    delete process.env.BOB_TEST_FOO;
  });

  test("replaces a token embedded in surrounding text", () => {
    process.env.BOB_TEST_HOST = "localhost";
    expect(resolveEnvVars("http://{env:BOB_TEST_HOST}:5432/db")).toBe(
      "http://localhost:5432/db",
    );
    delete process.env.BOB_TEST_HOST;
  });

  test("replaces multiple tokens in one string", () => {
    process.env.BOB_TEST_A = "a";
    process.env.BOB_TEST_B = "b";
    expect(resolveEnvVars("{env:BOB_TEST_A}-{env:BOB_TEST_B}")).toBe("a-b");
    delete process.env.BOB_TEST_A;
    delete process.env.BOB_TEST_B;
  });

  test("leaves non-token strings untouched", () => {
    expect(resolveEnvVars("plain string")).toBe("plain string");
  });
});

describe("resolveEnvVars — array/object recursion", () => {
  test("recurses into arrays", () => {
    process.env.BOB_TEST_ITEM = "resolved";
    expect(resolveEnvVars(["{env:BOB_TEST_ITEM}", "static"])).toEqual([
      "resolved",
      "static",
    ]);
    delete process.env.BOB_TEST_ITEM;
  });

  test("recurses into object values", () => {
    process.env.BOB_TEST_URL = "https://example.com";
    expect(resolveEnvVars({ url: "{env:BOB_TEST_URL}", name: "x" })).toEqual({
      url: "https://example.com",
      name: "x",
    });
    delete process.env.BOB_TEST_URL;
  });

  test("recurses into nested arrays and objects", () => {
    process.env.BOB_TEST_DEEP = "deep";
    const input = {
      a: [{ b: "{env:BOB_TEST_DEEP}" }, "plain"],
      c: "outer",
    };
    expect(resolveEnvVars(input)).toEqual({
      a: [{ b: "deep" }, "plain"],
      c: "outer",
    });
    delete process.env.BOB_TEST_DEEP;
  });
});

describe("resolveEnvVars — null/undefined handling", () => {
  test("returns null unchanged", () => {
    expect(resolveEnvVars(null)).toBeNull();
  });

  test("returns undefined unchanged", () => {
    expect(resolveEnvVars(undefined)).toBeUndefined();
  });

  test("returns numbers unchanged", () => {
    expect(resolveEnvVars(42)).toBe(42);
  });

  test("returns booleans unchanged", () => {
    expect(resolveEnvVars(true)).toBe(true);
  });
});

describe("resolveEnvVars — missing env vars", () => {
  test("replaces unknown token with empty string", () => {
    expect(resolveEnvVars("{env:BOB_TEST_DEFINITELY_MISSING}")).toBe("");
  });

  test("replaces missing token inside object with empty string", () => {
    expect(
      resolveEnvVars({ key: "{env:BOB_TEST_DEFINITELY_MISSING}" }),
    ).toEqual({
      key: "",
    });
  });
});

describe("resolveEnvVars — nested env references", () => {
  test("resolves env var whose value references another env var literally", () => {
    // resolveEnvVars only does a single pass; verify a value that itself
    // contains a token is not double-expanded (by design).
    process.env.BOB_TEST_OUTER = "{env:BOB_TEST_INNER}";
    process.env.BOB_TEST_INNER = "inner-value";
    expect(resolveEnvVars("{env:BOB_TEST_OUTER}")).toBe("{env:BOB_TEST_INNER}");
    delete process.env.BOB_TEST_OUTER;
    delete process.env.BOB_TEST_INNER;
  });

  test("resolves env vars at multiple nesting depths", () => {
    process.env.BOB_TEST_L1 = "level1";
    process.env.BOB_TEST_L2 = "level2";
    const input = {
      first: "{env:BOB_TEST_L1}",
      nested: {
        second: "{env:BOB_TEST_L2}",
        list: ["{env:BOB_TEST_L1}", "{env:BOB_TEST_L2}"],
      },
    };
    expect(resolveEnvVars(input)).toEqual({
      first: "level1",
      nested: {
        second: "level2",
        list: ["level1", "level2"],
      },
    });
    delete process.env.BOB_TEST_L1;
    delete process.env.BOB_TEST_L2;
  });
});
