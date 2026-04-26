# Hook Timings Reference

**Generated:** 2026-04-26

## HIAI_HOOK_TIMINGS Flag

When `HIAI_HOOK_TIMINGS=1` is set in the environment, hiai-opencode writes hook timing data to `hiai-hook-timings-<timestamp>.log` in the project directory.

## How It Works

1. Set `HIAI_HOOK_TIMINGS=1` before starting OpenCode
2. The plugin wraps each hook with a timing measurement
3. After each hook execution, timing data is appended to the log file
4. Log entries include: hook name, duration in ms, timestamp, session ID

## Log Format

```
[YYYY-MM-DD HH:MM:SS.mmm] hook=<hookName> duration=<ms>ms session=<sessionID>
```

## Enabling/Disabling

```bash
# Enable
HIAI_HOOK_TIMINGS=1 opencode

# Disable (unset the variable)
unset HIAI_HOOK_TIMINGS
```

## Analyzing Timings

The timing log helps identify:
- Slow hooks consuming LLM latency budget
- Hooks with high variance in execution time
- Session startup bottlenecks

## Hook Categories

| Category | Count | Notes |
|----------|-------|-------|
| Session hooks | 23 | Core lifecycle hooks |
| Tool guard hooks | 14 | Pre/post tool execution |
| Transform hooks | 5 | Message/prompt modification |
| Continuation hooks | 7 | Multi-turn continuation logic |
| Skill hooks | 2 | Skill-related hooks |

## Typical Timings (reference)

| Hook Type | Expected Duration |
|-----------|------------------|
| Simple session hooks | < 1ms |
| Tool guard hooks | 1-5ms |
| Transform hooks | 2-10ms |
| Continuation hooks | 5-20ms |

High durations (>50ms) indicate a potential optimization target.