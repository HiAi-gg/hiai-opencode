import { expect, test } from "bun:test"

import { getAgentConfigKey } from "./agent-display-names"

test("writer aliases resolve to brainstormer", () => {
  expect(getAgentConfigKey("writer")).toBe("writer")
  expect(getAgentConfigKey("copywriter")).toBe("writer")
  expect(getAgentConfigKey("content-writer")).toBe("writer")
  expect(getAgentConfigKey("brainstormer")).toBe("writer")
})
