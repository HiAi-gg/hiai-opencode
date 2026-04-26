import { expect, test } from "bun:test"

import { getAgentConfigKey } from "./agent-display-names"

test("writer aliases resolve to brainstormer", () => {
  expect(getAgentConfigKey("writer")).toBe("brainstormer")
  expect(getAgentConfigKey("copywriter")).toBe("brainstormer")
  expect(getAgentConfigKey("content-writer")).toBe("brainstormer")
})
