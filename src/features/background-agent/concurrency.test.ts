import { expect, test, describe } from "bun:test"
import { ConcurrencyManager } from "./concurrency"
import type { BackgroundTaskConfig } from "../../config/schema"

describe("Task 2.1: Parallel tasks — 3 simultaneous", () => {
  test("acquire allows up to limit concurrent tasks", async () => {
    const manager = new ConcurrencyManager()
    const key = "anthropic/claude-opus-4-6"

    await manager.acquire(key)
    await manager.acquire(key)
    await manager.acquire(key)

    expect(manager.getCount(key)).toBe(3)
  })

  test("acquire blocks when limit reached", async () => {
    const manager = new ConcurrencyManager()
    const key = "anthropic/claude-opus-4-6"

    await manager.acquire(key)
    await manager.acquire(key)
    await manager.acquire(key)
    await manager.acquire(key)
    await manager.acquire(key)

    let blocked = true
    const promise = manager.acquire(key).then(() => {
      blocked = false
    })

    expect(blocked).toBe(true)
    expect(manager.getQueueLength(key)).toBe(1)

    manager.release(key)
    await promise

    expect(blocked).toBe(false)
  })

  test("release hands off slot to waiting task", async () => {
    const manager = new ConcurrencyManager()
    const key = "test-model"

    await manager.acquire(key)
    await manager.acquire(key)
    await manager.acquire(key)
    await manager.acquire(key)
    await manager.acquire(key)

    const order: string[] = []

    const p1 = manager.acquire(key).then(() => order.push("first"))
    const p2 = manager.acquire(key).then(() => order.push("second"))

    manager.release(key)
    await p1

    expect(order).toEqual(["first"])

    manager.release(key)
    await p2

    expect(order).toEqual(["first", "second"])
  })

  test("custom concurrency limit from config", () => {
    const config: BackgroundTaskConfig = {
      defaultConcurrency: 3,
    }
    const manager = new ConcurrencyManager(config)

    expect(manager.getConcurrencyLimit("any-model")).toBe(3)
  })

  test("model-specific concurrency limit", () => {
    const config: BackgroundTaskConfig = {
      modelConcurrency: {
        "anthropic/claude-opus-4-6": 2,
      },
    }
    const manager = new ConcurrencyManager(config)

    expect(manager.getConcurrencyLimit("anthropic/claude-opus-4-6")).toBe(2)
    expect(manager.getConcurrencyLimit("anthropic/claude-sonnet-4-6")).toBe(5)
  })

  test("provider-specific concurrency limit", () => {
    const config: BackgroundTaskConfig = {
      providerConcurrency: {
        openai: 10,
      },
    }
    const manager = new ConcurrencyManager(config)

    expect(manager.getConcurrencyLimit("openai/gpt-4")).toBe(10)
    expect(manager.getConcurrencyLimit("anthropic/claude-opus-4-6")).toBe(5)
  })

  test("zero means unlimited concurrency", () => {
    const config: BackgroundTaskConfig = {
      defaultConcurrency: 0,
    }
    const manager = new ConcurrencyManager(config)

    expect(manager.getConcurrencyLimit("any-model")).toBe(Infinity)
  })

  test("cancelWaiters rejects pending acquires", async () => {
    const manager = new ConcurrencyManager()
    const key = "test-model"

    await manager.acquire(key)
    await manager.acquire(key)
    await manager.acquire(key)
    await manager.acquire(key)
    await manager.acquire(key)

    let rejected = false
    const promise = manager.acquire(key).catch(() => {
      rejected = true
    })

    manager.cancelWaiters(key)
    await promise

    expect(rejected).toBe(true)
  })

  test("clear cancels all waiters and resets state", async () => {
    const manager = new ConcurrencyManager()
    const key1 = "model-1"
    const key2 = "model-2"

    await manager.acquire(key1)
    await manager.acquire(key1)
    await manager.acquire(key1)
    await manager.acquire(key1)
    await manager.acquire(key1)
    await manager.acquire(key2)
    await manager.acquire(key2)
    await manager.acquire(key2)
    await manager.acquire(key2)
    await manager.acquire(key2)

    let rejected1 = false
    let rejected2 = false

    manager.acquire(key1).catch(() => {
      rejected1 = true
    })
    manager.acquire(key2).catch(() => {
      rejected2 = true
    })

    manager.clear()

    expect(manager.getCount(key1)).toBe(0)
    expect(manager.getCount(key2)).toBe(0)
    expect(manager.getQueueLength(key1)).toBe(0)
    expect(manager.getQueueLength(key2)).toBe(0)
  })
})
