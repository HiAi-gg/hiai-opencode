import { expect, test } from "bun:test";
import { withTimeout } from "./timeout.mjs";

test("withTimeout clears its timer after the operation resolves", async (): Promise<void> => {
  const startedAt = performance.now();
  await withTimeout(Promise.resolve("ok"), 1_000);
  const elapsed = performance.now() - startedAt;

  expect(elapsed).toBeLessThan(100);
});

