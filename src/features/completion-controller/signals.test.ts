import { describe, expect, test } from "bun:test";
import { matchesAnyGlob, parseCriticVerdict } from "./signals";

const UI = ["**/*.svelte", "**/*.css"];

describe("matchesAnyGlob", () => {
  test("matches ui file", () =>
    expect(matchesAnyGlob("src/x.svelte", UI)).toBe(true));
  test("non-ui file", () => expect(matchesAnyGlob("src/x.ts", UI)).toBe(false));
  test("nested path", () =>
    expect(matchesAnyGlob("a/b/c/component.css", UI)).toBe(true));
});

describe("parseCriticVerdict", () => {
  test("accept", () => {
    expect(
      parseCriticVerdict('<CLOSURE>{"readiness":"accept"}</CLOSURE>'),
    ).toBe("approved");
  });
  test("reject", () => {
    expect(
      parseCriticVerdict('<CLOSURE>{"readiness":"reject"}</CLOSURE>'),
    ).toBe("rejected");
  });
  test("single-quoted", () => {
    expect(
      parseCriticVerdict("<CLOSURE>{'readiness':'accept'}</CLOSURE>"),
    ).toBe("approved");
  });
  test("whitespace around colon", () => {
    expect(
      parseCriticVerdict('<CLOSURE>{"readiness" : "accept"}</CLOSURE>'),
    ).toBe("approved");
  });
  test("no closure -> null", () =>
    expect(parseCriticVerdict("just text")).toBeNull());
  test("closure without readiness -> null", () => {
    expect(parseCriticVerdict('<CLOSURE>{"foo":1}</CLOSURE>')).toBeNull();
  });
  test("reject verdict", () => {
    expect(
      parseCriticVerdict('<CLOSURE>{"readiness":"reject"}</CLOSURE>'),
    ).toBe("rejected");
  });
});
