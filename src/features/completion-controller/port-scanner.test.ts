import { describe, expect, test } from "bun:test"
import { scanOutputForEndpoints, aggregateEndpoints } from "./port-scanner"

describe("port-scanner.scanOutputForEndpoints", () => {
  test("detects localhost:port", () => {
    const eps = scanOutputForEndpoints("Server running at http://localhost:3000/api", "bash")
    expect(eps.length).toBeGreaterThanOrEqual(1)
    expect(eps.some((e) => e.port === 3000)).toBe(true)
    expect(eps[0].source).toBe("bash")
  })

  test("detects 0.0.0.0:port", () => {
    const eps = scanOutputForEndpoints("listening on 0.0.0.0:8080", "bash")
    expect(eps.length).toBeGreaterThan(0)
    expect(eps.some((e) => e.port === 8080)).toBe(true)
  })

  test("detects EXPOSE directive", () => {
    const eps = scanOutputForEndpoints("EXPOSE 5432", "read")
    expect(eps.some((e) => e.port === 5432)).toBe(true)
  })

  test("dedupes repeated matches", () => {
    const eps = scanOutputForEndpoints("localhost:3000 localhost:3000 localhost:3000", "bash")
    expect(eps.length).toBe(1)
  })

  test("ignores ports out of range", () => {
    const eps = scanOutputForEndpoints("localhost:99999", "bash")
    expect(eps.length).toBe(0)
  })

  test("handles empty input", () => {
    expect(scanOutputForEndpoints("", "bash")).toEqual([])
  })
})

describe("port-scanner.aggregateEndpoints", () => {
  test("aggregates across tools", () => {
    const eps = aggregateEndpoints([
      { tool: "bash", output: "Server listening on http://localhost:3000" },
      { tool: "read", output: "EXPOSE 5432" },
    ])
    expect(eps.length).toBeGreaterThanOrEqual(2)
    expect(eps.some((e) => e.port === 3000)).toBe(true)
    expect(eps.some((e) => e.port === 5432)).toBe(true)
  })

  test("dedupes across tools", () => {
    const eps = aggregateEndpoints([
      { tool: "bash", output: "localhost:3000" },
      { tool: "bash", output: "localhost:3000" },
    ])
    expect(eps.length).toBe(1)
  })
})
