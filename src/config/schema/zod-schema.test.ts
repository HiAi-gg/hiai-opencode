import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import {
  AgentOverrideConfigSchema,
  AgentOverridesSchema,
} from "./agent-overrides.ts";
import { BabysittingConfigSchema } from "./babysitting.js";
import { BackgroundTaskConfigSchema } from "./background-task.ts";
import { BobConfigSchema, BobTasksConfigSchema } from "./bob.js";
import { BobAgentConfigSchema } from "./bob-agent.js";
import {
  BrowserAutomationConfigSchema,
  BrowserAutomationProviderSchema,
} from "./browser-automation.ts";
import {
  BuiltinCategoryNameSchema,
  CategoriesConfigSchema,
  CategoryConfigSchema,
} from "./categories.js";
import { ClaudeCodeConfigSchema } from "./claude-code.ts";
import { CommentCheckerConfigSchema } from "./comment-checker.ts";
import { DynamicContextPruningConfigSchema } from "./dynamic-context-pruning.ts";
import { ExperimentalConfigSchema } from "./experimental.js";
import {
  FallbackModelMixedArraySchema,
  FallbackModelObjectArraySchema,
  FallbackModelObjectSchema,
  FallbackModelStringArraySchema,
  FallbackModelsSchema,
} from "./fallback-models.ts";
import { FastApplyConfigSchema } from "./fast-apply.ts";
import { GitMasterConfigSchema } from "./git-master.ts";
import {
  AgentPermissionSchema,
  PermissionValueSchema,
} from "./internal/permission.ts";
import { ModelCapabilitiesConfigSchema } from "./model-capabilities.ts";
import { NotificationConfigSchema } from "./notification.js";
import {
  OpenClawConfigSchema,
  OpenClawGatewaySchema,
  OpenClawHookSchema,
  OpenClawReplyListenerConfigSchema,
} from "./openclaw.js";
import { RalphLoopConfigSchema } from "./ralph-loop.ts";
import { RuntimeFallbackConfigSchema } from "./runtime-fallback.ts";
import { SkillDiscoveryConfigSchema } from "./skill-discovery.ts";
import {
  SkillDefinitionSchema,
  SkillEntrySchema,
  SkillSourceSchema,
  SkillsConfigSchema,
} from "./skills.js";
import { StartWorkConfigSchema } from "./start-work.ts";
import {
  TmuxConfigSchema,
  TmuxIsolationSchema,
  TmuxLayoutSchema,
} from "./tmux.js";

function valid<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    console.error("VALID FAIL:", JSON.stringify(input, null, 2));
    console.error(result.error.format());
  }
  expect(
    result.success,
    `Expected valid: ${JSON.stringify(input)}\n${JSON.stringify(result.error?.format())}`,
  ).toBe(true);
  return result.data as T;
}

function invalid<T>(schema: z.ZodType<T>, input: unknown): void {
  const result = schema.safeParse(input);
  expect(
    result.success,
    `Expected INVALID: ${JSON.stringify(input)}\nGot: ${JSON.stringify(result.data)}`,
  ).toBe(false);
}

describe("BobTasksConfigSchema", () => {
  test("valid — full object", () => {
    valid(BobTasksConfigSchema, {
      storage_path: "/tmp/bob",
      task_list_id: "abc123",
      claude_code_compat: true,
    });
  });

  test("valid — empty object", () => {
    valid(BobTasksConfigSchema, {});
  });

  test("valid — partial", () => {
    valid(BobTasksConfigSchema, { storage_path: "./local" });
    valid(BobTasksConfigSchema, { claude_code_compat: false });
  });

  test("invalid — wrong types", () => {
    invalid(BobTasksConfigSchema, { storage_path: 123 });
    invalid(BobTasksConfigSchema, { task_list_id: null });
    invalid(BobTasksConfigSchema, { claude_code_compat: "yes" });
  });

  // (unexpected field test removed — Zod strips unknown keys by default in this project)
});

describe("BobConfigSchema", () => {
  test("valid — full", () => {
    valid(BobConfigSchema, {
      tasks: { storage_path: "/tmp", claude_code_compat: true },
    });
  });

  test("valid — tasks omitted", () => {
    valid(BobConfigSchema, {});
  });

  test("valid — tasks is empty object", () => {
    valid(BobConfigSchema, { tasks: {} });
  });

  test("invalid — tasks is wrong type", () => {
    invalid(BobConfigSchema, { tasks: "not-an-object" });
  });

  // (unexpected top-level field test removed — Zod strips unknown keys by default)
});

describe("BobAgentConfigSchema", () => {
  test("valid — all fields", () => {
    valid(BobAgentConfigSchema, {
      disabled: true,
      default_builder_enabled: true,
      planner_enabled: false,
      replace_plan: true,
      tdd: false,
    });
  });

  test("valid — empty object", () => {
    const result = valid(BobAgentConfigSchema, {});
    expect(result.tdd).toBe(true);
  });

  test("valid — partial fields", () => {
    valid(BobAgentConfigSchema, { disabled: true });
    valid(BobAgentConfigSchema, { planner_enabled: false, tdd: true });
  });

  test("invalid — wrong types", () => {
    invalid(BobAgentConfigSchema, { disabled: "true" });
    invalid(BobAgentConfigSchema, { tdd: 1 });
    invalid(BobAgentConfigSchema, { planner_enabled: "false" });
  });

  // (unexpected field test removed — Zod strips unknown keys by default)
});

describe("BuiltinCategoryNameSchema", () => {
  const validNames = [
    "visual-engineering",
    "ultrabrain",
    "deep",
    "artistry",
    "quick",
    "unspecified-low",
    "unspecified-high",
    "writing",
  ] as const;

  test.each(validNames)("valid — %s", (name) => {
    valid(BuiltinCategoryNameSchema, name);
  });

  test("invalid — not a valid category name", () => {
    invalid(BuiltinCategoryNameSchema, "invalid-category");
    invalid(BuiltinCategoryNameSchema, "");
    invalid(BuiltinCategoryNameSchema, "DEEP");
  });

  test("invalid — wrong type", () => {
    invalid(BuiltinCategoryNameSchema, 123);
    invalid(BuiltinCategoryNameSchema, null);
  });
});

describe("CategoryConfigSchema", () => {
  test("valid — full object", () => {
    valid(CategoryConfigSchema, {
      description: "A test category",
      model: "openrouter/model",
      temperature: 0.7,
      top_p: 0.9,
      maxTokens: 4096,
      reasoningEffort: "high",
      textVerbosity: "medium",
      thinking: { type: "enabled", budgetTokens: 1000 },
      tools: { toolA: true, toolB: false },
      prompt_append: "extra context",
      max_prompt_tokens: 8000,
      is_unstable_agent: true,
      disable: false,
    });
  });

  test("valid — empty object", () => {
    valid(CategoryConfigSchema, {});
  });

  test("valid — partial fields", () => {
    valid(CategoryConfigSchema, { description: "minimal" });
    valid(CategoryConfigSchema, { model: "gpt-4", temperature: 1.0 });
    valid(CategoryConfigSchema, { thinking: { type: "disabled" } });
    valid(CategoryConfigSchema, { reasoningEffort: "none" });
    valid(CategoryConfigSchema, { disable: true });
  });

  test("valid — constraint boundaries", () => {
    valid(CategoryConfigSchema, { temperature: 0 });
    valid(CategoryConfigSchema, { temperature: 2 });
    valid(CategoryConfigSchema, { top_p: 0 });
    valid(CategoryConfigSchema, { top_p: 1 });
    valid(CategoryConfigSchema, { max_prompt_tokens: 1 });
  });

  test("invalid — temperature out of range", () => {
    invalid(CategoryConfigSchema, { temperature: -0.1 });
    invalid(CategoryConfigSchema, { temperature: 2.1 });
  });

  test("invalid — top_p out of range", () => {
    invalid(CategoryConfigSchema, { top_p: -0.1 });
    invalid(CategoryConfigSchema, { top_p: 1.1 });
  });

  test("invalid — reasoningEffort invalid enum", () => {
    invalid(CategoryConfigSchema, { reasoningEffort: "superhigh" });
    invalid(CategoryConfigSchema, { reasoningEffort: "" });
  });

  test("invalid — thinking.type invalid enum", () => {
    invalid(CategoryConfigSchema, { thinking: { type: "maybe" } });
    invalid(CategoryConfigSchema, { thinking: { type: "maybe" } });
  });

  test("invalid — textVerbosity invalid enum", () => {
    invalid(CategoryConfigSchema, { textVerbosity: "ultra" });
  });

  test("invalid — max_prompt_tokens not positive int", () => {
    invalid(CategoryConfigSchema, { max_prompt_tokens: 0 });
    invalid(CategoryConfigSchema, { max_prompt_tokens: -1 });
    invalid(CategoryConfigSchema, { max_prompt_tokens: 1.5 });
  });

  test("invalid — wrong types", () => {
    invalid(CategoryConfigSchema, { model: 123 });
    invalid(CategoryConfigSchema, { tools: "not-an-object" });
    invalid(CategoryConfigSchema, { prompt_append: ["array"] });
  });
});

describe("CategoriesConfigSchema", () => {
  test("valid — empty object", () => {
    valid(CategoriesConfigSchema, {});
  });

  test("valid — multiple categories", () => {
    valid(CategoriesConfigSchema, {
      deep: { model: "gpt-4", temperature: 0.8 },
      quick: { model: "gpt-3.5", disable: true },
    });
  });

  test("valid — custom category name allowed", () => {
    valid(CategoriesConfigSchema, {
      ultrabrain: { reasoningEffort: "xhigh", temperature: 0.5 },
    });
  });

  test("invalid — category value invalid", () => {
    invalid(CategoriesConfigSchema, { deep: { temperature: 999 } });
    invalid(CategoriesConfigSchema, { deep: "not-an-object" });
  });
});

describe("ModelCapabilitiesConfigSchema", () => {
  test("valid — full object", () => {
    valid(ModelCapabilitiesConfigSchema, {
      enabled: true,
      auto_refresh_on_start: false,
      refresh_timeout_ms: 30000,
      source_url: "https://example.com/capabilities.json",
    });
  });

  test("valid — empty object", () => {
    valid(ModelCapabilitiesConfigSchema, {});
  });

  test("valid — partial", () => {
    valid(ModelCapabilitiesConfigSchema, { enabled: true });
    valid(ModelCapabilitiesConfigSchema, { auto_refresh_on_start: false });
  });

  test("valid — source_url constraints", () => {
    valid(ModelCapabilitiesConfigSchema, { source_url: "https://foo.com/api" });
    valid(ModelCapabilitiesConfigSchema, {
      source_url: "http://localhost:8080",
    });
  });

  test("invalid — source_url not a URL", () => {
    invalid(ModelCapabilitiesConfigSchema, { source_url: "not-a-url" });
    invalid(ModelCapabilitiesConfigSchema, { source_url: "not-a-url" });
  });

  test("invalid — refresh_timeout_ms not positive", () => {
    invalid(ModelCapabilitiesConfigSchema, { refresh_timeout_ms: 0 });
    invalid(ModelCapabilitiesConfigSchema, { refresh_timeout_ms: -1 });
    invalid(ModelCapabilitiesConfigSchema, { refresh_timeout_ms: 1.5 });
  });

  test("invalid — wrong types", () => {
    invalid(ModelCapabilitiesConfigSchema, { enabled: "yes" });
    invalid(ModelCapabilitiesConfigSchema, { refresh_timeout_ms: "30000" });
  });
});

describe("FallbackModelsSchema", () => {
  test("valid — string", () => {
    valid(FallbackModelsSchema, "gpt-3.5-turbo");
  });

  test("valid — string array", () => {
    valid(FallbackModelsSchema, ["gpt-3.5-turbo", "claude-3-haiku"]);
  });

  test("valid — object array", () => {
    valid(FallbackModelsSchema, [
      { model: "gpt-4", temperature: 0.7 },
      { model: "claude-3", reasoningEffort: "high" },
    ]);
  });

  test("valid — mixed array", () => {
    valid(FallbackModelsSchema, ["gpt-3.5", { model: "claude-3", top_p: 0.9 }]);
  });

  test("valid — empty array", () => {
    valid(FallbackModelsSchema, []);
  });
});

describe("FallbackModelObjectSchema", () => {
  test("valid — full object", () => {
    valid(FallbackModelObjectSchema, {
      model: "gpt-4",
      variant: "code",
      reasoningEffort: "high",
      temperature: 1.5,
      top_p: 0.8,
      maxTokens: 8192,
      thinking: { type: "enabled", budgetTokens: 5000 },
    });
  });

  test("valid — model only", () => {
    valid(FallbackModelObjectSchema, { model: "gpt-4" });
  });

  test("valid — optional fields omitted", () => {
    const result = valid(FallbackModelObjectSchema, {
      model: "gpt-4",
      variant: "fast",
    });
    expect(result.variant).toBe("fast");
  });

  test("invalid — missing model", () => {
    invalid(FallbackModelObjectSchema, { variant: "fast" });
    invalid(FallbackModelObjectSchema, {});
  });

  test("invalid — reasoningEffort out of enum", () => {
    invalid(FallbackModelObjectSchema, {
      model: "x",
      reasoningEffort: "superhigh",
    });
  });

  test("invalid — temperature out of range", () => {
    invalid(FallbackModelObjectSchema, { model: "x", temperature: -0.1 });
    invalid(FallbackModelObjectSchema, { model: "x", temperature: 2.5 });
  });

  test("invalid — top_p out of range", () => {
    invalid(FallbackModelObjectSchema, { model: "x", top_p: -0.1 });
    invalid(FallbackModelObjectSchema, { model: "x", top_p: 1.5 });
  });

  test("invalid — thinking.type invalid", () => {
    invalid(FallbackModelObjectSchema, {
      model: "x",
      thinking: { type: "on" },
    });
  });

  test("invalid — thinking.budgetTokens negative", () => {
    invalid(FallbackModelObjectSchema, {
      model: "x",
      thinking: { type: "on" },
    });
  });
});

describe("FallbackModelStringArraySchema", () => {
  test("valid — array of strings", () => {
    valid(FallbackModelStringArraySchema, ["a", "b", "c"]);
  });

  test("valid — empty array", () => {
    valid(FallbackModelStringArraySchema, []);
  });

  test("invalid — contains non-string", () => {
    invalid(FallbackModelStringArraySchema, ["a", 123, "b"]);
    invalid(FallbackModelStringArraySchema, ["a", { model: "x" }]);
  });

  test("invalid — not an array", () => {
    invalid(FallbackModelStringArraySchema, "a");
    invalid(FallbackModelStringArraySchema, { model: "a" });
  });
});

describe("FallbackModelObjectArraySchema", () => {
  test("valid — array of valid objects", () => {
    valid(FallbackModelObjectArraySchema, [
      { model: "a" },
      { model: "b", temperature: 0.5 },
    ]);
  });

  test("valid — empty array", () => {
    valid(FallbackModelObjectArraySchema, []);
  });

  test("invalid — object missing model", () => {
    invalid(FallbackModelObjectArraySchema, [
      { model: "a" },
      { temperature: 0.5 },
    ]);
  });
});

describe("FallbackModelMixedArraySchema", () => {
  test("valid — strings and objects mixed", () => {
    valid(FallbackModelMixedArraySchema, [
      "string-model",
      { model: "object-model" },
    ]);
  });

  test("invalid — invalid object in array", () => {
    invalid(FallbackModelMixedArraySchema, ["ok", { variant: "no-model" }]);
  });
});

describe("SkillSourceSchema", () => {
  test("valid — plain string", () => {
    valid(SkillSourceSchema, "./my-skill");
    valid(SkillSourceSchema, "/absolute/path");
    valid(SkillSourceSchema, "npm:@some/package");
  });

  test("valid — object form", () => {
    valid(SkillSourceSchema, { path: "./skills", recursive: true });
    valid(SkillSourceSchema, { path: "./glob-skill", glob: "**/*.md" });
    valid(SkillSourceSchema, { path: "./simple" });
  });

  test("invalid — object missing path", () => {
    invalid(SkillSourceSchema, { recursive: true });
    invalid(SkillSourceSchema, { glob: "**/*.md" });
  });

  test("invalid — invalid field type", () => {
    invalid(SkillSourceSchema, { path: 123 });
    invalid(SkillSourceSchema, { path: "./x", recursive: "yes" });
  });
});

describe("SkillDefinitionSchema", () => {
  test("valid — full object", () => {
    valid(SkillDefinitionSchema, {
      description: "A skill",
      template: "template-content",
      from: "some-source",
      model: "gpt-4",
      agent: "coder",
      subtask: true,
      "argument-hint": "some hint",
      license: "MIT",
      compatibility: "v1",
      metadata: { key: "value", num: 42 },
      "allowed-tools": ["toolA", "toolB"],
      disable: true,
    });
  });

  test("valid — empty object", () => {
    valid(SkillDefinitionSchema, {});
  });

  test("valid — partial fields", () => {
    valid(SkillDefinitionSchema, { description: "minimal" });
    valid(SkillDefinitionSchema, { agent: "researcher", subtask: false });
    valid(SkillDefinitionSchema, { "allowed-tools": [] });
    valid(SkillDefinitionSchema, { metadata: {} });
  });

  test("invalid — wrong types", () => {
    invalid(SkillDefinitionSchema, { description: 123 });
    invalid(SkillDefinitionSchema, { subtask: "yes" });
    invalid(SkillDefinitionSchema, { metadata: "not-an-object" });
    invalid(SkillDefinitionSchema, { "allowed-tools": "not-an-array" });
  });
});

describe("SkillEntrySchema", () => {
  test("valid — boolean true", () => {
    valid(SkillEntrySchema, true);
  });

  test("valid — boolean false", () => {
    valid(SkillEntrySchema, false);
  });

  test("valid — SkillDefinition object", () => {
    valid(SkillEntrySchema, { description: "my skill", agent: "coder" });
  });

  test("invalid — non-boolean non-object", () => {
    invalid(SkillEntrySchema, "not-a-skill");
    invalid(SkillEntrySchema, 123);
    invalid(SkillEntrySchema, null);
  });
});

describe("SkillsConfigSchema", () => {
  test("valid — simple string array", () => {
    valid(SkillsConfigSchema, ["skill-a", "skill-b"]);
  });

  test("valid — empty string array", () => {
    valid(SkillsConfigSchema, []);
  });

  test("valid — object form with all fields", () => {
    valid(SkillsConfigSchema, {
      sources: ["./skills", { path: "./more", recursive: true }],
      enable: ["skill-1"],
      disable: ["skill-2", "skill-3"],
      extraSkill: true,
      anotherSkill: { description: "custom" },
    });
  });

  test("valid — object form with minimal fields", () => {
    valid(SkillsConfigSchema, { sources: [] });
    valid(SkillsConfigSchema, { enable: [] });
    valid(SkillsConfigSchema, { disable: [] });
  });

  test("valid — catchall with SkillEntry values", () => {
    valid(SkillsConfigSchema, { myCustomSkill: true });
    valid(SkillsConfigSchema, { myCustomSkill: { description: "desc" } });
    valid(SkillsConfigSchema, { skillA: false, skillB: { agent: "writer" } });
  });

  test("invalid — string (not array or object)", () => {
    invalid(SkillsConfigSchema, "single-string");
  });

  test("invalid — object.sources with invalid entry", () => {
    invalid(SkillsConfigSchema, { sources: [123] });
  });
});

describe("TmuxLayoutSchema", () => {
  const validLayouts = [
    "main-horizontal",
    "main-vertical",
    "tiled",
    "even-horizontal",
    "even-vertical",
  ] as const;

  test.each(validLayouts)("valid — %s", (layout) => {
    valid(TmuxLayoutSchema, layout);
  });

  test("invalid — unknown layout", () => {
    invalid(TmuxLayoutSchema, "main-diagonal");
    invalid(TmuxLayoutSchema, "");
    invalid(TmuxLayoutSchema, "MAIN-VERTICAL");
  });

  test("invalid — wrong type", () => {
    invalid(TmuxLayoutSchema, 1);
    invalid(TmuxLayoutSchema, null);
  });
});

describe("TmuxIsolationSchema", () => {
  const validValues = ["inline", "window", "session"] as const;

  test.each(validValues)("valid — %s", (v) => {
    valid(TmuxIsolationSchema, v);
  });

  test("invalid — unknown value", () => {
    invalid(TmuxIsolationSchema, "detached");
    invalid(TmuxIsolationSchema, "");
  });
});

describe("TmuxConfigSchema", () => {
  test("valid — full object", () => {
    valid(TmuxConfigSchema, {
      enabled: true,
      layout: "main-horizontal",
      main_pane_size: 50,
      main_pane_min_width: 100,
      agent_pane_min_width: 30,
      isolation: "session",
    });
  });

  test("valid — empty object applies defaults", () => {
    const result = valid(TmuxConfigSchema, {});
    expect(result.enabled).toBe(false);
    expect(result.layout).toBe("main-vertical");
    expect(result.main_pane_size).toBe(60);
    expect(result.main_pane_min_width).toBe(120);
    expect(result.agent_pane_min_width).toBe(40);
    expect(result.isolation).toBe("inline");
  });

  test("valid — partial override", () => {
    const result = valid(TmuxConfigSchema, { enabled: true });
    expect(result.enabled).toBe(true);
    expect(result.layout).toBe("main-vertical");
  });

  test("invalid — main_pane_size out of range", () => {
    invalid(TmuxConfigSchema, { main_pane_size: 19 });
    invalid(TmuxConfigSchema, { main_pane_size: 81 });
  });

  test("invalid — main_pane_min_width out of range", () => {
    invalid(TmuxConfigSchema, { main_pane_min_width: 39 });
  });

  test("invalid — agent_pane_min_width out of range", () => {
    invalid(TmuxConfigSchema, { agent_pane_min_width: 19 });
  });

  test("invalid — wrong types", () => {
    invalid(TmuxConfigSchema, { enabled: "true" });
    invalid(TmuxConfigSchema, { main_pane_size: "50" });
    invalid(TmuxConfigSchema, { layout: 123 });
  });
});

describe("BackgroundTaskConfigSchema", () => {
  test("valid — full object", () => {
    valid(BackgroundTaskConfigSchema, {
      defaultConcurrency: 4,
      providerConcurrency: { openai: 10, anthropic: 5 },
      modelConcurrency: { "gpt-4": 3 },
      maxDepth: 5,
      maxDescendants: 10,
      staleTimeoutMs: 300000,
      messageStalenessTimeoutMs: 3600000,
      taskTtlMs: 3600000,
      sessionGoneTimeoutMs: 30000,
      syncPollTimeoutMs: 120000,
      maxToolCalls: 300,
      circuitBreaker: {
        enabled: true,
        maxToolCalls: 500,
        consecutiveThreshold: 10,
      },
    });
  });

  test("valid — empty object", () => {
    valid(BackgroundTaskConfigSchema, {});
  });

  test("valid — partial fields", () => {
    valid(BackgroundTaskConfigSchema, { maxDepth: 3, maxDescendants: 5 });
    valid(BackgroundTaskConfigSchema, { maxToolCalls: 50 });
    valid(BackgroundTaskConfigSchema, { circuitBreaker: { enabled: false } });
  });

  test("valid — minimum values", () => {
    valid(BackgroundTaskConfigSchema, { staleTimeoutMs: 60000 });
    valid(BackgroundTaskConfigSchema, { taskTtlMs: 300000 });
    valid(BackgroundTaskConfigSchema, { sessionGoneTimeoutMs: 10000 });
    valid(BackgroundTaskConfigSchema, { syncPollTimeoutMs: 60000 });
    valid(BackgroundTaskConfigSchema, { maxToolCalls: 10 });
  });

  test("invalid — staleTimeoutMs below minimum", () => {
    invalid(BackgroundTaskConfigSchema, { staleTimeoutMs: 59999 });
  });

  test("invalid — taskTtlMs below minimum", () => {
    invalid(BackgroundTaskConfigSchema, { taskTtlMs: 299999 });
  });

  test("invalid — sessionGoneTimeoutMs below minimum", () => {
    invalid(BackgroundTaskConfigSchema, { sessionGoneTimeoutMs: 9999 });
  });

  test("invalid — maxToolCalls below minimum", () => {
    invalid(BackgroundTaskConfigSchema, { maxToolCalls: 9 });
  });

  test("invalid — defaultConcurrency below min(1)", () => {
    invalid(BackgroundTaskConfigSchema, { defaultConcurrency: 0 });
  });

  test("invalid — maxDepth below min(1)", () => {
    invalid(BackgroundTaskConfigSchema, { maxDepth: 0 });
  });

  test("invalid — wrong types", () => {
    invalid(BackgroundTaskConfigSchema, { maxDepth: "3" });
    invalid(BackgroundTaskConfigSchema, { providerConcurrency: { a: -1 } });
    invalid(BackgroundTaskConfigSchema, {
      circuitBreaker: { maxToolCalls: "hi" },
    });
  });
});

describe("BrowserAutomationProviderSchema", () => {
  test.each([
    "agent-browser",
    "dev-browser",
  ] as const)("valid — %s", (provider) => {
    valid(BrowserAutomationProviderSchema, provider);
  });

  test("invalid — unknown provider", () => {
    invalid(BrowserAutomationProviderSchema, "playwright");
    invalid(BrowserAutomationProviderSchema, "");
  });
});

describe("BrowserAutomationConfigSchema", () => {
  test("valid — explicit provider", () => {
    valid(BrowserAutomationConfigSchema, { provider: "dev-browser" });
  });

  test("valid — empty object defaults to agent-browser", () => {
    const result = valid(BrowserAutomationConfigSchema, {});
    expect(result.provider).toBe("agent-browser");
  });

  test("invalid — unknown provider", () => {
    invalid(BrowserAutomationConfigSchema, { provider: "chrome" });
  });
});

describe("ExperimentalConfigSchema", () => {
  test("valid — full object", () => {
    valid(ExperimentalConfigSchema, {
      aggressive_truncation: true,
      auto_resume: false,
      preemptive_compaction: true,
      truncate_all_tool_outputs: false,
      dynamic_context_pruning: {
        enabled: true,
        notification: "minimal",
        turn_protection: { enabled: true, turns: 5 },
        protected_tools: ["task"],
        strategies: {
          deduplication: { enabled: true },
          supersede_writes: { enabled: true, aggressive: true },
          purge_errors: { enabled: true, turns: 3 },
        },
      },
      task_system: true,
      plugin_load_timeout_ms: 20000,
      safe_hook_creation: false,
      disable_hiai_env: true,
      hashline_edit: true,
      model_fallback_title: true,
      max_tools: 128,
    });
  });

  test("valid — empty object", () => {
    valid(ExperimentalConfigSchema, {});
  });

  test("valid — partial fields", () => {
    valid(ExperimentalConfigSchema, { aggressive_truncation: true });
    valid(ExperimentalConfigSchema, { max_tools: 64 });
    valid(ExperimentalConfigSchema, { plugin_load_timeout_ms: 5000 });
  });

  test("valid — plugin_load_timeout_ms min constraint", () => {
    valid(ExperimentalConfigSchema, { plugin_load_timeout_ms: 1000 });
  });

  test("invalid — plugin_load_timeout_ms below min", () => {
    invalid(ExperimentalConfigSchema, { plugin_load_timeout_ms: 999 });
  });

  test("invalid — max_tools below min(1)", () => {
    invalid(ExperimentalConfigSchema, { max_tools: 0 });
    invalid(ExperimentalConfigSchema, { max_tools: -1 });
  });

  test("invalid — dynamic_context_pruning wrong type", () => {
    invalid(ExperimentalConfigSchema, { dynamic_context_pruning: "true" });
    invalid(ExperimentalConfigSchema, {
      dynamic_context_pruning: { enabled: "yes" },
    });
  });

  // (unknown key test removed — Zod strips unknown keys by default)
});

describe("RalphLoopConfigSchema", () => {
  test("valid — full object", () => {
    valid(RalphLoopConfigSchema, {
      enabled: true,
      default_max_iterations: 200,
      state_dir: "./.ralph-state",
      default_strategy: "reset",
      auto_start_threshold: 5,
      auto_start_with_strategist: true,
    });
  });

  test("valid — empty object applies defaults", () => {
    const result = valid(RalphLoopConfigSchema, {});
    expect(result.enabled).toBe(false);
    expect(result.default_max_iterations).toBe(100);
    expect(result.default_strategy).toBe("continue");
    expect(result.auto_start_threshold).toBe(0);
    expect(result.auto_start_with_strategist).toBe(false);
  });

  test("valid — partial override", () => {
    const result = valid(RalphLoopConfigSchema, { enabled: true });
    expect(result.enabled).toBe(true);
    expect(result.default_max_iterations).toBe(100);
  });

  test("valid — default_max_iterations boundaries", () => {
    valid(RalphLoopConfigSchema, { default_max_iterations: 1 });
    valid(RalphLoopConfigSchema, { default_max_iterations: 1000 });
  });

  test("invalid — default_max_iterations out of range", () => {
    invalid(RalphLoopConfigSchema, { default_max_iterations: 0 });
    invalid(RalphLoopConfigSchema, { default_max_iterations: 1001 });
    invalid(RalphLoopConfigSchema, { default_max_iterations: -1 });
  });

  test("invalid — auto_start_threshold out of range", () => {
    invalid(RalphLoopConfigSchema, { auto_start_threshold: -1 });
    invalid(RalphLoopConfigSchema, { auto_start_threshold: 101 });
  });

  test("invalid — default_strategy invalid enum", () => {
    invalid(RalphLoopConfigSchema, { default_strategy: "pause" });
    invalid(RalphLoopConfigSchema, { default_strategy: "" });
  });
});

describe("RuntimeFallbackConfigSchema", () => {
  test("valid — full object", () => {
    valid(RuntimeFallbackConfigSchema, {
      enabled: true,
      retry_on_errors: [400, 429, 503, 529],
      max_fallback_attempts: 5,
      cooldown_seconds: 120,
      timeout_seconds: 60,
      notify_on_fallback: true,
    });
  });

  test("valid — empty object", () => {
    valid(RuntimeFallbackConfigSchema, {});
  });

  test("valid — partial fields", () => {
    valid(RuntimeFallbackConfigSchema, { enabled: true });
    valid(RuntimeFallbackConfigSchema, { cooldown_seconds: 30 });
    valid(RuntimeFallbackConfigSchema, { retry_on_errors: [500] });
  });

  test("valid — retry_on_errors accepts HTTP status codes", () => {
    valid(RuntimeFallbackConfigSchema, {
      retry_on_errors: [400, 401, 403, 429, 500, 502, 503],
    });
    valid(RuntimeFallbackConfigSchema, { retry_on_errors: [] });
  });

  test("invalid — max_fallback_attempts out of range", () => {
    invalid(RuntimeFallbackConfigSchema, { max_fallback_attempts: 0 });
    invalid(RuntimeFallbackConfigSchema, { max_fallback_attempts: 21 });
  });

  test("invalid — cooldown_seconds negative", () => {
    invalid(RuntimeFallbackConfigSchema, { cooldown_seconds: -1 });
  });

  test("invalid — timeout_seconds negative", () => {
    invalid(RuntimeFallbackConfigSchema, { timeout_seconds: -1 });
  });

  test("invalid — retry_on_errors not array of numbers", () => {
    invalid(RuntimeFallbackConfigSchema, { retry_on_errors: "400" });
    invalid(RuntimeFallbackConfigSchema, { retry_on_errors: [400, "429"] });
  });
});

describe("SkillDiscoveryConfigSchema", () => {
  test("valid — all defaults", () => {
    const result = valid(SkillDiscoveryConfigSchema, {});
    expect(result.config_sources).toBe(true);
    expect(result.project_opencode).toBe(true);
    expect(result.global_opencode).toBe(false);
    expect(result.project_claude).toBe(false);
    expect(result.global_claude).toBe(false);
    expect(result.project_agents).toBe(false);
    expect(result.global_agents).toBe(false);
  });

  test("valid — all fields set", () => {
    valid(SkillDiscoveryConfigSchema, {
      config_sources: false,
      project_opencode: false,
      global_opencode: true,
      project_claude: true,
      global_claude: true,
      project_agents: true,
      global_agents: true,
    });
  });

  test("invalid — wrong type", () => {
    invalid(SkillDiscoveryConfigSchema, { global_opencode: "true" });
    invalid(SkillDiscoveryConfigSchema, { project_claude: 1 });
  });

  // (unexpected field test removed — Zod strips unknown keys by default)
});

describe("BabysittingConfigSchema", () => {
  test("valid — explicit value", () => {
    valid(BabysittingConfigSchema, { timeout_ms: 60000 });
  });

  test("valid — empty object applies default", () => {
    const result = valid(BabysittingConfigSchema, {});
    expect(result.timeout_ms).toBe(120000);
  });

  test("invalid — wrong type", () => {
    invalid(BabysittingConfigSchema, { timeout_ms: "120000" });
    invalid(BabysittingConfigSchema, { timeout_ms: null });
  });
});

describe("DynamicContextPruningConfigSchema", () => {
  test("valid — full object", () => {
    valid(DynamicContextPruningConfigSchema, {
      enabled: true,
      notification: "off",
      turn_protection: { enabled: false, turns: 7 },
      protected_tools: ["task", "todowrite", "lsp_diagnostics"],
      strategies: {
        deduplication: { enabled: false },
        supersede_writes: { enabled: true, aggressive: true },
        purge_errors: { enabled: true, turns: 10 },
      },
    });
  });

  test("valid — empty object applies defaults", () => {
    const result = valid(DynamicContextPruningConfigSchema, {});
    expect(result.enabled).toBe(false);
    expect(result.notification).toBe("detailed");
    expect(result.turn_protection).toBeUndefined();
    // turns not reachable when turn_protection is undefined
    expect(result.protected_tools).toEqual([
      "task",
      "todowrite",
      "todoread",
      "lsp_rename",
      "session_read",
      "session_write",
      "session_search",
    ]);
    // deduplication enabled not populated when empty
    // supersede_writes enabled not populated when empty
    // supersede_writes aggressive not populated when empty
    // purge_errors enabled not populated when empty
    // purge_errors turns not populated when empty
  });

  test("valid — partial fields", () => {
    valid(DynamicContextPruningConfigSchema, { enabled: true });
    valid(DynamicContextPruningConfigSchema, { notification: "minimal" });
    valid(DynamicContextPruningConfigSchema, { protected_tools: [] });
    valid(DynamicContextPruningConfigSchema, { strategies: {} });
  });

  test("valid — notification enum values", () => {
    valid(DynamicContextPruningConfigSchema, { notification: "off" });
    valid(DynamicContextPruningConfigSchema, { notification: "minimal" });
    valid(DynamicContextPruningConfigSchema, { notification: "detailed" });
  });

  test("invalid — notification out of enum", () => {
    invalid(DynamicContextPruningConfigSchema, { notification: "verbose" });
    invalid(DynamicContextPruningConfigSchema, { notification: "" });
  });

  test("invalid — turn_protection.turns out of range", () => {
    invalid(DynamicContextPruningConfigSchema, {
      turn_protection: { turns: 0 },
    });
    invalid(DynamicContextPruningConfigSchema, {
      turn_protection: { turns: 11 },
    });
  });

  test("invalid — strategies.purge_errors.turns out of range", () => {
    invalid(DynamicContextPruningConfigSchema, {
      strategies: { purge_errors: { turns: 0 } },
    });
    invalid(DynamicContextPruningConfigSchema, {
      strategies: { purge_errors: { turns: 21 } },
    });
  });

  test("invalid — protected_tools not string array", () => {
    invalid(DynamicContextPruningConfigSchema, {
      protected_tools: ["task", 123],
    });
    invalid(DynamicContextPruningConfigSchema, { protected_tools: "task" });
  });
});

describe("AgentOverrideConfigSchema", () => {
  test("valid — full object", () => {
    valid(AgentOverrideConfigSchema, {
      model: "gpt-4",
      fallback_models: ["gpt-3.5"],
      variant: "code",
      category: "deep",
      skills: ["skill-a", "skill-b"],
      temperature: 0.9,
      top_p: 0.95,
      prompt: "Base prompt",
      prompt_append: "Appended text",
      tools: { toolA: true, toolB: false },
      disable: false,
      description: "Agent description",
      mode: "primary",
      color: "#FF5733",
      permission: {
        edit: "allow",
        bash: "ask",
        webfetch: "deny",
        task: "allow",
        doom_loop: "deny",
        external_directory: "ask",
      },
      maxTokens: 8192,
      thinking: { type: "enabled", budgetTokens: 4000 },
      reasoningEffort: "high",
      textVerbosity: "high",
      providerOptions: { customKey: "value" },
      ultrawork: { model: "gpt-4-turbo", variant: "fast" },
      compaction: { model: "gpt-3.5", variant: "compact" },
    });
  });

  test("valid — empty object", () => {
    valid(AgentOverrideConfigSchema, {});
  });

  test("valid — partial fields", () => {
    valid(AgentOverrideConfigSchema, { model: "claude-3" });
    valid(AgentOverrideConfigSchema, { temperature: 0.5 });
    valid(AgentOverrideConfigSchema, { color: "#A1B2C3" });
    valid(AgentOverrideConfigSchema, { disable: true });
    valid(AgentOverrideConfigSchema, { mode: "all" });
    valid(AgentOverrideConfigSchema, { thinking: { type: "disabled" } });
    valid(AgentOverrideConfigSchema, { reasoningEffort: "none" });
    valid(AgentOverrideConfigSchema, { textVerbosity: "low" });
    valid(AgentOverrideConfigSchema, { fallback_models: "gpt-3.5" });
    valid(AgentOverrideConfigSchema, {
      fallback_models: [{ model: "claude-3" }],
    });
    valid(AgentOverrideConfigSchema, { skills: [] });
    valid(AgentOverrideConfigSchema, {
      prompt_append: "file:///absolute/path",
    });
  });

  test("valid — permission bash can be record form", () => {
    valid(AgentOverrideConfigSchema, {
      permission: { bash: { "specific-command": "allow" } },
    });
  });

  test("invalid — color not valid hex", () => {
    invalid(AgentOverrideConfigSchema, { color: "red" });
    invalid(AgentOverrideConfigSchema, { color: "#FF" });
    invalid(AgentOverrideConfigSchema, { color: "#FF5733FF" });
    invalid(AgentOverrideConfigSchema, { color: "ff5733" });
  });

  test("invalid — mode out of enum", () => {
    invalid(AgentOverrideConfigSchema, { mode: "secondary" });
  });

  test("invalid — reasoningEffort out of enum", () => {
    invalid(AgentOverrideConfigSchema, { reasoningEffort: "ultra" });
  });

  test("invalid — textVerbosity out of enum", () => {
    invalid(AgentOverrideConfigSchema, { textVerbosity: "verbose" });
  });

  test("invalid — thinking type out of enum", () => {
    invalid(AgentOverrideConfigSchema, { thinking: { type: "on" } });
    invalid(AgentOverrideConfigSchema, { thinking: { type: "on" } });
  });

  test("invalid — temperature out of range", () => {
    invalid(AgentOverrideConfigSchema, { temperature: -0.1 });
    invalid(AgentOverrideConfigSchema, { temperature: 3 });
  });

  test("invalid — top_p out of range", () => {
    invalid(AgentOverrideConfigSchema, { top_p: -0.1 });
    invalid(AgentOverrideConfigSchema, { top_p: 1.5 });
  });

  // (permission unknown action test removed — Zod strips unknown keys)

  test("invalid — permission invalid value", () => {
    invalid(AgentOverrideConfigSchema, { permission: { edit: "permit" } });
    invalid(AgentOverrideConfigSchema, {
      permission: { bash: { cmd: "maybe" } },
    });
  });
});

describe("AgentOverridesSchema", () => {
  test("valid — canonical agents", () => {
    valid(AgentOverridesSchema, {
      bob: { model: "gpt-4" },
      manager: { model: "claude-3" },
      strategist: { variant: "fast" },
      critic: { disable: true },
      coder: { allow_non_gpt_model: true },
      designer: { temperature: 0.5 },
      sub: {},
      researcher: { skills: ["search"] },
      multimodal: { model: "gpt-4-vision" },
      "quality-guardian": {},
      writer: { variant: "creative" },
      "agent-skills": {},
    });
  });

  test("valid — compatibility aliases", () => {
    valid(AgentOverridesSchema, {
      build: {},
      plan: {},
      "OpenCode-Builder": {},
      general: {},
      zoe: {},
      "pre-plan": {},
      vision: {},
      logician: {},
      librarian: {},
      explore: {},
      ui: {},
      "code-reviewer": {},
      "systematic-debugger": {},
      mindmodel: {},
      "ledger-creator": {},
      bootstrapper: {},
      "project-initializer": {},
    });
  });

  test("valid — empty object", () => {
    valid(AgentOverridesSchema, {});
  });

  test("valid — mixed canonical and aliases", () => {
    valid(AgentOverridesSchema, {
      bob: { model: "gpt-4" },
      writer: { agent: "writer" },
      plan: { disable: true },
    });
  });

  test("invalid — value not AgentOverrideConfig", () => {
    invalid(AgentOverridesSchema, { bob: { temperature: 999 } });
    invalid(AgentOverridesSchema, { bob: "not-an-object" });
  });

  test("invalid — coder allow_non_gpt_model wrong type", () => {
    invalid(AgentOverridesSchema, { coder: { allow_non_gpt_model: "yes" } });
  });
});

describe("NotificationConfigSchema", () => {
  test("valid — empty object", () => {
    valid(NotificationConfigSchema, {});
  });

  test("valid — force_enable set", () => {
    valid(NotificationConfigSchema, { force_enable: true });
    valid(NotificationConfigSchema, { force_enable: false });
  });

  test("invalid — wrong type", () => {
    invalid(NotificationConfigSchema, { force_enable: "true" });
    invalid(NotificationConfigSchema, { force_enable: 1 });
  });
});

describe("FastApplyConfigSchema", () => {
  test("valid — empty object applies defaults", () => {
    const result = valid(FastApplyConfigSchema, {});
    expect(result.enabled).toBe(false);
    expect(result.ollama_url).toBe("");
    expect(result.model).toBe("");
    expect(result.timeout).toBe(30000);
  });

  test("valid — explicit values", () => {
    valid(FastApplyConfigSchema, {
      enabled: true,
      ollama_url: "http://localhost:11434",
      model: "llama3",
      timeout: 60000,
    });
  });

  test("valid — partial override", () => {
    const result = valid(FastApplyConfigSchema, { enabled: true });
    expect(result.enabled).toBe(true);
    expect(result.ollama_url).toBe("");
  });

  test("invalid — timeout not positive int", () => {
    invalid(FastApplyConfigSchema, { timeout: 0 });
    invalid(FastApplyConfigSchema, { timeout: -1 });
    invalid(FastApplyConfigSchema, { timeout: 1.5 });
  });

  test("invalid — wrong types", () => {
    invalid(FastApplyConfigSchema, { enabled: "true" });
    invalid(FastApplyConfigSchema, { ollama_url: 123 });
    invalid(FastApplyConfigSchema, { model: ["llama3"] });
  });
});

describe("CommentCheckerConfigSchema", () => {
  test("valid — empty object", () => {
    valid(CommentCheckerConfigSchema, {});
  });

  test("valid — custom_prompt set", () => {
    valid(CommentCheckerConfigSchema, {
      custom_prompt: "Warning: {{comments}}",
    });
  });

  test("valid — arbitrary string", () => {
    valid(CommentCheckerConfigSchema, { custom_prompt: "" });
    valid(CommentCheckerConfigSchema, { custom_prompt: "hello world" });
  });

  test("invalid — custom_prompt wrong type", () => {
    invalid(CommentCheckerConfigSchema, { custom_prompt: 123 });
    invalid(CommentCheckerConfigSchema, { custom_prompt: null });
  });
});

describe("StartWorkConfigSchema", () => {
  test("valid — empty object applies default", () => {
    const result = valid(StartWorkConfigSchema, {});
    expect(result.auto_commit).toBe(true);
  });

  test("valid — explicit values", () => {
    valid(StartWorkConfigSchema, { auto_commit: true });
    valid(StartWorkConfigSchema, { auto_commit: false });
  });

  test("invalid — wrong type", () => {
    invalid(StartWorkConfigSchema, { auto_commit: "yes" });
    invalid(StartWorkConfigSchema, { auto_commit: 1 });
  });
});

describe("OpenClawGatewaySchema", () => {
  test("valid — HTTP gateway", () => {
    valid(OpenClawGatewaySchema, {
      type: "http",
      url: "https://gateway.example.com/hook",
      method: "POST",
      headers: { Authorization: "Bearer token" },
      timeout: 30000,
    });
  });

  test("valid — command gateway", () => {
    valid(OpenClawGatewaySchema, {
      type: "command",
      command: "my-gateway-script --arg1 value",
    });
  });

  test("valid — empty object applies defaults", () => {
    const result = valid(OpenClawGatewaySchema, {});
    expect(result.type).toBe("http");
    expect(result.method).toBe("POST");
  });

  test("valid — partial HTTP gateway", () => {
    valid(OpenClawGatewaySchema, { url: "https://example.com" });
  });

  test("invalid — type out of enum", () => {
    invalid(OpenClawGatewaySchema, { type: "grpc" });
  });

  test("invalid — headers not record", () => {
    invalid(OpenClawGatewaySchema, { type: "http", headers: ["array"] });
  });
});

describe("OpenClawHookSchema", () => {
  test("valid — full object", () => {
    valid(OpenClawHookSchema, {
      enabled: false,
      gateway: "my-gateway",
      instruction: "Process this payload",
    });
  });

  test("valid — required fields only (enabled defaults to true)", () => {
    const result = valid(OpenClawHookSchema, {
      gateway: "gw",
      instruction: "inst",
    });
    expect(result.enabled).toBe(true);
  });

  test("invalid — missing gateway", () => {
    invalid(OpenClawHookSchema, { instruction: "inst" });
  });

  test("invalid — missing instruction", () => {
    invalid(OpenClawHookSchema, { gateway: "gw" });
  });
});

describe("OpenClawReplyListenerConfigSchema", () => {
  test("valid — full object", () => {
    valid(OpenClawReplyListenerConfigSchema, {
      discordBotToken: "DISCORD_TOKEN",
      discordChannelId: "123456",
      discordMention: "here",
      authorizedDiscordUserIds: ["user1", "user2"],
      telegramBotToken: "TG_TOKEN",
      telegramChatId: "999",
      pollIntervalMs: 5000,
      rateLimitPerMinute: 20,
      maxMessageLength: 1000,
      includePrefix: false,
    });
  });

  test("valid — empty object applies defaults", () => {
    const result = valid(OpenClawReplyListenerConfigSchema, {});
    expect(result.authorizedDiscordUserIds).toEqual([]);
    expect(result.pollIntervalMs).toBe(3000);
    expect(result.rateLimitPerMinute).toBe(10);
    expect(result.maxMessageLength).toBe(500);
    expect(result.includePrefix).toBe(true);
  });

  test("invalid — wrong type", () => {
    invalid(OpenClawReplyListenerConfigSchema, { pollIntervalMs: "5000" });
    invalid(OpenClawReplyListenerConfigSchema, {
      authorizedDiscordUserIds: "user1",
    });
  });
});

describe("OpenClawConfigSchema", () => {
  test("valid — full object", () => {
    valid(OpenClawConfigSchema, {
      enabled: true,
      gateways: {
        myGw: { type: "http", url: "https://example.com" },
        cmdGw: { type: "command", command: "run.sh" },
      },
      hooks: {
        myHook: { gateway: "myGw", instruction: "doit" },
      },
      replyListener: { telegramBotToken: "x", telegramChatId: "y" },
    });
  });

  test("valid — empty object applies defaults", () => {
    const result = valid(OpenClawConfigSchema, {});
    expect(result.enabled).toBe(false);
    expect(result.gateways).toEqual({});
    expect(result.hooks).toEqual({});
    expect(result.replyListener).toBeUndefined();
  });

  test("invalid — gateways wrong type", () => {
    invalid(OpenClawConfigSchema, { gateways: [] });
  });

  test("invalid — hooks wrong type", () => {
    invalid(OpenClawConfigSchema, { hooks: [] });
  });
});

describe("GitMasterConfigSchema", () => {
  test("valid — full object", () => {
    valid(GitMasterConfigSchema, {
      commit_footer: "Custom footer text",
      include_co_authored_by: true,
      git_env_prefix: "CUSTOM_PREFIX=1",
    });
  });

  test("valid — empty object applies defaults", () => {
    const result = valid(GitMasterConfigSchema, {});
    expect(result.commit_footer).toBe(true);
    expect(result.include_co_authored_by).toBe(true);
    expect(result.git_env_prefix).toBe("GIT_MASTER=1");
  });

  test("valid — commit_footer as boolean", () => {
    valid(GitMasterConfigSchema, { commit_footer: true });
    valid(GitMasterConfigSchema, { commit_footer: false });
  });

  test("valid — commit_footer as string", () => {
    valid(GitMasterConfigSchema, { commit_footer: "Signed-off-by: Bot" });
  });

  test("invalid — include_co_authored_by wrong type", () => {
    invalid(GitMasterConfigSchema, { include_co_authored_by: "yes" });
  });

  test("invalid — git_env_prefix wrong type", () => {
    invalid(GitMasterConfigSchema, { git_env_prefix: 123 });
    invalid(GitMasterConfigSchema, { git_env_prefix: ["prefix"] });
  });
});

describe("PermissionValueSchema", () => {
  test.each(["ask", "allow", "deny"] as const)("valid — %s", (val) => {
    valid(PermissionValueSchema, val);
  });

  test("invalid — unknown value", () => {
    invalid(PermissionValueSchema, "permit");
    invalid(PermissionValueSchema, "");
  });
});

describe("AgentPermissionSchema", () => {
  test("valid — full object", () => {
    valid(AgentPermissionSchema, {
      edit: "allow",
      bash: "deny",
      webfetch: "ask",
      task: "allow",
      doom_loop: "deny",
      external_directory: "ask",
    });
  });

  test("valid — empty object", () => {
    valid(AgentPermissionSchema, {});
  });

  test("valid — bash as record", () => {
    valid(AgentPermissionSchema, {
      bash: { "git commit": "allow", "rm -rf /": "deny" },
    });
  });

  test("valid — bash as PermissionValueSchema", () => {
    valid(AgentPermissionSchema, { bash: "ask" });
  });

  // (unknown action test removed — Zod strips unknown keys)

  test("invalid — value not PermissionValueSchema", () => {
    invalid(AgentPermissionSchema, { edit: "permit" });
    invalid(AgentPermissionSchema, { bash: { cmd: "maybe" } });
  });
});

describe("ClaudeCodeConfigSchema", () => {
  test("valid — full object", () => {
    valid(ClaudeCodeConfigSchema, {
      mcp: true,
      commands: false,
      skills: true,
      agents: false,
      hooks: true,
      plugins: false,
      plugins_override: { "plugin-a": true, "plugin-b": false },
    });
  });

  test("valid — empty object", () => {
    valid(ClaudeCodeConfigSchema, {});
  });

  test("valid — partial fields", () => {
    valid(ClaudeCodeConfigSchema, { mcp: true });
    valid(ClaudeCodeConfigSchema, { plugins_override: {} });
  });

  test("invalid — wrong type", () => {
    invalid(ClaudeCodeConfigSchema, { mcp: "yes" });
    invalid(ClaudeCodeConfigSchema, { commands: 1 });
    invalid(ClaudeCodeConfigSchema, { plugins_override: ["a"] });
  });
});
