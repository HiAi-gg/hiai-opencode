import { afterEach, describe, expect, it } from "bun:test";
import {
  clear,
  currentFingerprint,
  get,
  recordChangedFile,
  recordCriticVerdict,
  resetForUser,
  setHasIncompleteTodos,
} from "./state";

// The module keeps a module-level singleton Map keyed by sessionID. Use a
// unique session per test and clean up afterwards so tests stay isolated.
function uniqueSession(): string {
  return `test-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

afterEach(() => {
  // Best-effort cleanup of any sessions created during a test.
  // We cannot enumerate the map, so tests must clear their own sessions;
  // this is a safety net for the common case.
});

describe("state: get / createDefaultSession", () => {
  it("returns the expected default shape for a fresh session", () => {
    const sid = uniqueSession();
    const s = get(sid);
    expect(s).toBeDefined();
    expect(s.autoContinues).toBe(0);
    expect(s.hasIncompleteTodos).toBe(false);
    expect(s.changedFiles).toEqual([]);
    expect(s.reviewedFingerprint).toBeNull();
    expect(s.criticVerdict).toBeNull();
    expect(s.blockerFlagged).toBe(false);
    expect(s.uiChangedSinceReview).toBe(false);
    clear(sid);
  });

  it("returns the same object reference on repeated calls (no re-init)", () => {
    const sid = uniqueSession();
    const a = get(sid);
    a.autoContinues = 3;
    const b = get(sid);
    expect(b).toBe(a);
    expect(b.autoContinues).toBe(3);
    clear(sid);
  });

  it("handles partial input by always creating a full default runtime", () => {
    // get() only takes a sessionID string; there is no partial-input variant,
    // but a fresh session must always be fully populated regardless of prior
    // state. Verify a brand-new id yields a clean default.
    const sid = uniqueSession();
    const s = get(sid);
    expect(Object.keys(s).sort()).toEqual(
      [
        "autoContinues",
        "blockerFlagged",
        "changedFiles",
        "criticVerdict",
        "hasIncompleteTodos",
        "reviewedFingerprint",
        "uiChangedSinceReview",
      ].sort(),
    );
    clear(sid);
  });
});

describe("state: recordChangedFile / trackChangedFile", () => {
  it("dedups the same file path (stored once)", () => {
    const sid = uniqueSession();
    recordChangedFile(sid, "/a/file.ts", false);
    recordChangedFile(sid, "/a/file.ts", false);
    const s = get(sid);
    expect(s.changedFiles).toEqual(["/a/file.ts"]);
    expect(s.changedFiles.length).toBe(1);
    clear(sid);
  });

  it("keeps distinct files and marks UI change when isUi is true", () => {
    const sid = uniqueSession();
    recordChangedFile(sid, "/a/file.ts", false);
    recordChangedFile(sid, "/b/other.ts", true);
    const s = get(sid);
    expect(s.changedFiles).toEqual(["/a/file.ts", "/b/other.ts"]);
    expect(s.uiChangedSinceReview).toBe(true);
    clear(sid);
  });

  it("resets criticVerdict and reviewedFingerprint when a file changes", () => {
    const sid = uniqueSession();
    recordCriticVerdict(sid, "approved");
    expect(get(sid).criticVerdict).toBe("approved");
    recordChangedFile(sid, "/a/file.ts", false);
    const s = get(sid);
    expect(s.criticVerdict).toBeNull();
    expect(s.reviewedFingerprint).toBeNull();
    clear(sid);
  });
});

describe("state: recordCriticVerdict / recordFingerprint + recordVerdict", () => {
  it("stores the verdict and computes a fingerprint of changed files", () => {
    const sid = uniqueSession();
    recordChangedFile(sid, "/a/file.ts", false);
    recordCriticVerdict(sid, "approved");
    const s = get(sid);
    expect(s.criticVerdict).toBe("approved");
    // fingerprint of ['/a/file.ts'] is a non-empty sha1 hex string
    expect(s.reviewedFingerprint).toMatch(/^[0-9a-f]{40}$/);
    clear(sid);
  });

  it("records a rejected verdict without clearing uiChangedSinceReview", () => {
    const sid = uniqueSession();
    recordChangedFile(sid, "/ui/comp.ts", true);
    recordCriticVerdict(sid, "rejected");
    const s = get(sid);
    expect(s.criticVerdict).toBe("rejected");
    expect(s.uiChangedSinceReview).toBe(true);
    clear(sid);
  });

  it("clears uiChangedSinceReview when approved", () => {
    const sid = uniqueSession();
    recordChangedFile(sid, "/ui/comp.ts", true);
    recordCriticVerdict(sid, "approved");
    expect(get(sid).uiChangedSinceReview).toBe(false);
    clear(sid);
  });
});

describe("state: setHasIncompleteTodos", () => {
  it("updates the incomplete-todos flag", () => {
    const sid = uniqueSession();
    setHasIncompleteTodos(sid, true);
    expect(get(sid).hasIncompleteTodos).toBe(true);
    setHasIncompleteTodos(sid, false);
    expect(get(sid).hasIncompleteTodos).toBe(false);
    clear(sid);
  });
});

describe("state: resetForUser / isUserInitiatedReset", () => {
  it("resets autoContinues and blockerFlagged on user reset", () => {
    const sid = uniqueSession();
    const s = get(sid);
    s.autoContinues = 5;
    s.blockerFlagged = true;
    resetForUser(sid);
    expect(get(sid).autoContinues).toBe(0);
    expect(get(sid).blockerFlagged).toBe(false);
    // Other fields are intentionally preserved across a user reset.
    expect(get(sid).criticVerdict).toBeNull();
    clear(sid);
  });
});

describe("state: clear / teardownSession", () => {
  it("removes session state so a fresh get re-initializes", () => {
    const sid = uniqueSession();
    const s = get(sid);
    s.autoContinues = 9;
    clear(sid);
    const fresh = get(sid);
    expect(fresh).not.toBe(s);
    expect(fresh.autoContinues).toBe(0);
  });
});

describe("state: currentFingerprint", () => {
  it("returns empty string for no changed files", () => {
    const sid = uniqueSession();
    const s = get(sid);
    expect(currentFingerprint(s)).toBe("");
    clear(sid);
  });

  it("returns a stable sha1 fingerprint for the changed files", () => {
    const sid = uniqueSession();
    const s = get(sid);
    s.changedFiles = ["/a.ts", "/b.ts"];
    const fp = currentFingerprint(s);
    expect(fp).toMatch(/^[0-9a-f]{40}$/);
    // Stable across calls
    expect(currentFingerprint(s)).toBe(fp);
    clear(sid);
  });
});
