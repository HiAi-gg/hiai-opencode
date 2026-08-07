# Taste
- Communicates in Russian and expects replies in Russian. Confidence: 0.9
- Prefers the smallest correct solution: minimal, focused changes; avoid over-engineering, avoid redesigning unrelated behavior, and avoid adding hooks/mechanisms merely because they exist. Confidence: 0.9
- Prefers using native/built-in mechanisms over custom replacements or duplicated implementations unless compatibility proves otherwise. Confidence: 0.9
- Wants investigation/inspection (code, versions, upstream behavior) before patching; no changes until the root cause is understood. Confidence: 0.8
- Wants regression tests covering behavioral contracts (prompt requirements, permissions, skills) as part of a fix. Confidence: 0.8
- Verifies upstream behavior against the actual pinned/installed version rather than blindly copying the latest upstream. Confidence: 0.7
- Prefers deterministic enforcement (metadata/context, explicit permissions) over fragile natural-language heuristics (e.g., regex/parsing of text). Confidence: 0.7
- Wants agents to be autonomous by default: resolve ambiguity through research, repo conventions, and best judgment; human questioning is exceptional, explicit opt-in only, and must never interrupt autonomous orchestration loops. Confidence: 0.8
