# Hooks Reference

**Generated:** 2026-04-26

This document catalogs all 64 hooks used by hiai-opencode for OpenCode plugin integration.

## Hook Architecture

Hooks are composed in three tiers:
- **Session hooks**: 23 hooks handling session lifecycle and state
- **Tool guard hooks**: 14 hooks enforcing pre/post tool execution policies
- **Transform hooks**: 5 hooks modifying messages and prompts

## Session Hooks (`create-session-hooks.ts`)

| Hook Name | Trigger | Purpose | Side Effects |
|-----------|---------|---------|--------------|
| `session.created` | Session created | Initialize session state, model cache | Sets session agent, model state |
| `session.deleted` | Session deleted | Cleanup session resources | Clears session cache, removes temp files |
| `session.idle` | Session becomes idle | Advance return chains, loop iterations | Processes deferred returns, triggers loops |
| `session.error` | Session error | Log error, attempt recovery | Records error state, triggers fallback |
| `chat.message` | Chat message received | First-message variant gate, keyword detection | Sets session variant, triggers keywords |
| `chat.params` | Chat parameters resolved | Anthropic effort level, think mode | Applies effort/temperature settings |
| `chat.headers` | Chat headers built | Copilot x-initiator header injection | Adds authentication headers |
| `ralphLoop` | Ultrawork mode | Ralph loop continuation enforcement | Tracks task progress, continues work |
| `todoContinuationEnforcer` | TODO tool used | Enforces todo continuation via system directive | Injects continuation reminders |
| `sessionRecovery` | Session recovery triggered | Recovery from context exhaustion | Stores/resotres session state |
| `preemptiveCompaction` | Token limit approaching | Preemptive context reduction | Compresses context before limit |
| `ultraworkVariantAvailability` | Ultrawork mode check | Determines if ultrawork available | Flags session for ultrawork |
| `ultraworDBModelOverride` | Ultrawork DB access | Database-level model override | Overrides model from DB |
| `ultraworkModelOverride` | Ultrawork enabled | Runtime model override for ultrawork | Applies model changes |
| `noBobGpt` | Bob agent GPT check | Blocks GPT for Bob agent | Modifies model selection |
| `noCoderNonGpt` | Coder non-GPT check | Blocks non-GPT for coder | Modifies model selection |
| `nonInteractiveEnv` | Environment check | Detects non-interactive environment | Sets environment flags |
| `agentUsageReminder` | Agent action | Reminds about agent usage policies | Logs agent usage |
| `sessionTodoStatus` | Session todo update | Tracks TODO task status across session | Updates todo state |
| `writeExistingFileGuard` | Write tool on existing file | Prevents overwrite of existing files | Guards file writes |
| `webfetchRedirectGuard` | Webfetch redirect | Blocks redirects to untrusted domains | Validates redirect URLs |
| `sessionStatusNormalizer` | Session status check | Normalizes status across OpenCode versions | Standardizes status |

## Tool Guard Hooks (`create-tool-guard-hooks.ts`)

| Hook Name | Trigger | Purpose | Side Effects |
|-----------|---------|---------|--------------|
| `tool.execute.before` | Tool execution starts | Pre-tool guards, file guard, label truncator | Injects rules, validates paths |
| `tool.execute.after` | Tool execution completes | Post-tool processing, output truncation | Truncates output, logs metadata |
| `toolPairValidator` | Tool pair execution | Validates sequential tool pairs | Blocks invalid sequences |
| `toolOutputTruncator` | Tool output generated | Truncates large tool outputs | Limits output size |
| `preemptiveCompactionNoTextTail` | Compaction without text tail | Prevents text tail removal during compaction | Preserves text tail |
| `preemptiveCompactionDegradationMonitor` | Compaction degradation | Monitors quality degradation during compaction | Tracks degradation metrics |
| `modelFallback` | Model unavailable | Attempts fallback chain on model failure | Switches to fallback model |
| `modelFallbackChatMessage` | Chat message with fallback | Handles chat message fallback | Retries with fallback |
| `thinkMode` | Think mode enabled | Manages thinking block behavior | Validates thinking usage |
| `thinkingBlockValidator` | Thinking block detected | Validates thinking block content | Checks block validity |
| `unstableAgentBabysitter` | Unstable agent detected | Tracks unstable agent behavior | Monitors agent stability |
| `toolExecuteBeforeGuard` | Pre-execution guard | Additional pre-tool validation | Validates tool call |
| `toolExecuteAfterGuard` | Post-execution guard | Additional post-tool validation | Reviews tool output |
| `availableCategories` | Category build | Builds category list for agent prompts | Generates category metadata |

## Transform Hooks (`create-transform-hooks.ts`)

| Hook Name | Trigger | Purpose | Side Effects |
|-----------|---------|---------|--------------|
| `experimental.chat.messages.transform` | Message transform | Context injection, thinking block validation | Modifies message content |
| `session.compacting` | Session compaction | Context + TODO preservation | Preserves context during compaction |
| `experimental.session.compacting` | Session compaction | Alternative compaction hook | Handles session compaction |
| `compactionContextInjector` | Context during compaction | Injects context during compaction | Adds context data |
| `compactionTodoPreserver` | TODO during compaction | Preserves TODO state during compaction | Saves todo state |

## Skill Hooks (`create-skill-hooks.ts`)

| Hook Name | Trigger | Purpose | Side Effects |
|-----------|---------|---------|--------------|
| `skill.context` | Skill context requested | Builds skill context for tools | Generates skill metadata |
| `agentUsageReminder` | Agent action | Reminds about skill usage | Logs skill usage |

## Hook Configuration

Hooks can be disabled via `hiai-opencode.json`:

```json
{
  "hooks": {
    "disabled": [
      "preemptiveCompaction",
      "modelFallback"
    ]
  }
}
```

## Hook Timing (when `HIAI_HOOK_TIMINGS=1`)

Enable hook timing measurement by setting the environment variable:
```
HIAI_HOOK_TIMINGS=1 opencode ...
```

Timings are written to `OPENCODE_LOG` with format: `hook:<name>:<duration_ms>`

## Key Hook Dependencies

```
session.created
    └── session.idle
            └── sessionRecovery
                    └── session.deleted

tool.execute.before
    └── tool.execute.after
            └── toolOutputTruncator

chat.message
    ├── keywordDetector
    │       └── ralphLoop
    │               └── todoContinuationEnforcer
    └── chat.params
            └── thinkMode

experimental.chat.messages.transform
    └── session.compacting
            ├── compactionContextInjector
            └── compactionTodoPreserver
```