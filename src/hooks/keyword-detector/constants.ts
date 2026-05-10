export const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g
export const INLINE_CODE_PATTERN = /`[^`]+`/g

export { isPlannerAgent, isNonOmoAgent, getUltraworkMessage } from "./ultrawork"
export { SEARCH_PATTERN, SEARCH_MESSAGE } from "./search"
export { ANALYZE_PATTERN, ANALYZE_MESSAGE } from "./analyze"

import { getUltraworkMessage } from "./ultrawork"
import { SEARCH_PATTERN, SEARCH_MESSAGE } from "./search"

export type KeywordDetector = {
  pattern: RegExp
  message: string | ((agentName?: string, modelID?: string) => string)
}

export const KEYWORD_DETECTORS: KeywordDetector[] = [
  {
    pattern: /\b(ultrawork|ulw)\b/i,
    message: getUltraworkMessage,
  },
  {
    pattern: SEARCH_PATTERN,
    message: SEARCH_MESSAGE,
  },
  {
    pattern:
      /\b(analyze|analyse|investigate|examine|research|study|deep[\s-]?dive|inspect|audit|evaluate|assess|review|diagnose|scrutinize|dissect|debug|comprehend|interpret|breakdown|understand)\b|why\s+is|how\s+does|how\s+to|분석|조사|파악|연구|검토|진단|이해|설명|원인|이유|뜯어봐|따져봐|평가|해석|디버깅|디버그|어떻게|왜|살펴|分析|調査|解析|検討|研究|診断|理解|説明|検証|精査|究明|デバッグ|なぜ|どう|仕組み|调查|检查|剖析|深入|诊断|解释|调试|为什么|原理|搞清楚|弄明白|phân tích|điều tra|nghiên cứu|kiểm tra|xem xét|chẩn đoán|giải thích|tìm hiểu|gỡ lỗi|tại sao/i,
    message: `[analyze-mode]
ANALYSIS MODE. Gather context before diving deep:
CONTEXT GATHERING (parallel):
- 1-2 researcher agents (codebase patterns, implementations)
- 1-2 researcher agents (official docs, OSS examples, if external library involved)
- Direct tools: Grep, AST-grep, LSP for targeted searches

IF COMPLEX - DO NOT STRUGGLE ALONE. Consult specialists:
- **Strategist**: Architecture, planning, and complex design choices
- **Critic**: Debugging, verification, and high-risk review
- **Artistry**: Non-conventional problems (different approach needed)

SYNTHESIZE findings before proceeding.
---
MANDATORY delegate_task params: ALWAYS include load_skills=[] and run_in_background when calling delegate_task.
Example: delegate_task(subagent_type="researcher", prompt="...", run_in_background=true, load_skills=[])`,
  },
  {
    pattern: /\b(design|ui|ux|visual|frontend|layout|brand(ing)?|design.system|style|beautiful|aesthetic|polish|look.and.feel|user.interface|user.experience|css|styling|theme|color.palette|typography.scale|responsive|animation|transition|hover.effect|shadow|border.radius|spacing|grid|flexbox)\b/i,
    message: `[search-mode]
MAXIMIZE SEARCH EFFORT. Launch multiple background researcher agents IN PARALLEL:
- researcher agents (codebase patterns, file structures, ast-grep)
- researcher agents (remote repos, official docs, GitHub examples)
Plus direct tools: Grep, ripgrep (rg), ast-grep (sg)
NEVER stop at first result - be exhaustive.

[visual-mode]
VISUAL/UI WORK. Use task(category="visual-engineering", load_skills=["frontend-ui-ux"]) for implementation.
For exploration: research existing patterns before building.`,
  },
  {
    pattern: /\b(architecture|system.design|dependency.(map|graph)|boundar(y|ies)|integration.(point|pattern)|module.boundary|API.design|contract|data.flow|component.tree)\b/i,
    message: `[search-mode]
→ Use task(subagent_type='manager', load_skills=['api-and-interface-design'], ...)

[guard-mode]
→ Consult Guard for system architecture review`,
  },
]
