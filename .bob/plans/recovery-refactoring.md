# Recovery Plan: Восстановление рефакторинга hiai-opencode

## TL;DR
> Восстановить 175 файлов рефакторинга из `stash@{0}`, разрешить конфликты на 19 пересекающихся файлах, добавить 65 новых untracked-файлов, проверить сборку, закоммитить.

## Context

**Что случилось**: Сегодня (2026-05-10) был выполнен масштабный рефакторинг hiai-opencode (~175 файлов). В течение дня произошло 5 жёстких `git reset --hard`, которые откатили незакоммиченные изменения. Git автоматически сохранил всё в `stash@{0}`, но после последнего reset'а только 21 из 175 файлов были восстановлены в рабочую директорию.

**Текущее состояние**:
| Категория | Количество | Статус |
|-----------|-----------|--------|
| stash@{0} | 175 файлов | Все изменения сохранены, ждут восстановления |
| Working tree modified | 21 файл | Частично восстановлено (Guard→Manager rename) |
| Overlap (stash ∩ working tree) | 19 файлов | Будут конфликты при `git stash pop` |
| Stash-only (без overlap) | 156 файлов | Применятся чисто |
| Untracked files | 65 файлов | Новые файлы, не тронуты git reset |

**Масштаб рефакторинга**:
1. Переименование Guard → Manager (~100+ файлов)
2. Переименование Brainstormer → Writer (~30+ файлов)
3. Переименование call-omo-agent → call-hiai-agent (16 новых файлов)
4. Новые хуки: src/hooks/manager/ (24), mempalace-auto-save (4)
5. Новый инструмент: agent-browser (5)
6. MCP cleanup: удалены playwright, firecrawl, rag из .mcp.json
7. Улучшение Designer: Vision verification gate
8. Улучшение Strategist: UI design pipeline
9. Обновление документации: AGENTS.md, ARCHITECTURE.md, README.md

## Work Objectives

1. **Безопасно применить stash** без потери текущих изменений
2. **Разрешить конфликты** на 19 пересекающихся файлах (stash vs working tree)
3. **Верифицировать untracked-файлы** — убедиться что 65 новых файлов полные и корректные
4. **Проверить сборку** — `bun run build` должен succeed
5. **Закоммитить всё** одним осмысленным коммитом

## Verification Strategy

- **Build check**: `bun run build` успешно (exit 0)
- **Doctor check**: `hiai-opencode doctor` показывает 9 agents, 8 MCP connected
- **Git verification**: `git status` чистый после коммита
- **Agent QA**: Запустить `opencode debug config` и `opencode mcp list` для финальной проверки

## Execution Strategy

- **Волна 1 (Safety)**: Создать бэкап-ветку, проверить целостность stash — 1 задача
- **Волна 2 (Recovery)**: Применить stash, разрешить конфликты, проверить untracked — 3 задачи
- **Волна 3 (Verification)**: Сборка, doctor, финальная проверка — 3 задачи
- **Волна 4 (Commit)**: Закоммитить и верифицировать чистоту — 2 задачи

---

## TODOs

### Wave 1: Safety — Бэкап и верификация

- [ ] 1. Создать бэкап-ветку и проверить целостность stash

  **What to do**: 
  1. Создать бэкап-ветку `backup/pre-recovery-2026-05-10` от текущего HEAD — это страховка на случай если recovery пойдёт не так
  2. Проверить stash целостность: `git stash show --stat stash@{0}` — убедиться что 175 файлов на месте
  3. Проверить что stash@{0} — единственный stash: `git stash list` — должен быть ровно один
  4. Записать SHA текущего HEAD для возможности отката

  **QA Scenarios**:
  - `git branch` показывает новую ветку `backup/pre-recovery-2026-05-10`
  - `git stash show --stat stash@{0}` показывает 175 files changed
  - `git stash list | wc -l` возвращает 1 (ровно один stash)

---

### Wave 2: Recovery — Применение stash и разрешение конфликтов

- [ ] 2. Определить стратегию разрешения конфликтов для 19 пересекающихся файлов

  **What to do**:
  1. Проанализировать 19 пересекающихся файлов (те, что есть и в stash, и в working tree)
  2. Для каждого файла определить: stash-версия новее или working-tree-версия?
  3. Стратегия по умолчанию: приоритет stash-версии (она содержит полный рефакторинг), но проверить что working tree не содержит уникальных исправлений (вроде фикса PTY в `src/internals/plugins/pty/pty/tools/list.ts`)
  4. Исключение: если файл есть ТОЛЬКО в working tree (не в overlap), сохранить working tree версию

  **19 конфликтующих файлов**:
  - `.mcp.json`
  - `assets/cli/hiai-opencode.mjs`
  - `hiai-opencode.json`
  - `src/agents/builtin-agents.ts`
  - `src/agents/builtin-agents/general-agents.ts`
  - `src/agents/builtin-agents/guard-agent.ts`
  - `src/agents/designer.ts`
  - `src/agents/guard/index.ts`
  - `src/agents/strategist/identity-constraints.ts`
  - `src/agents/strategist/plan-template.ts`
  - `src/agents/types.ts`
  - `src/config/defaults.ts`
  - `src/config/platform-schema.ts`
  - `src/config/schema/agent-names.ts`
  - `src/config/types.ts`
  - `src/shared/agent-display-names.ts`
  - `src/shared/migration/agent-names.ts`
  - `src/shared/mode-routing.ts`
  - `src/tools/delegate-task/sub-agent.ts`

  **QA Scenarios**:
  - Для каждого из 19 файлов определён источник: "stash" или "working-tree"
  - Стратегия задокументирована (какой файл откуда берём)

- [ ] 3. Применить stash и разрешить конфликты на 19 файлах

  **What to do**:
  1. Выполнить `git stash pop stash@{0}`. Ожидаем конфликты на 19 файлах.
  2. Для каждого конфликтующего файла применить стратегию из Task 2:
     - Если stash-версия: `git checkout --theirs <file> && git add <file>`
     - Если working-tree-версия: `git checkout --ours <file> && git add <file>`
  3. Для 156 stash-only файлов — применятся автоматически (без конфликтов)
  4. Убедиться что `src/internals/plugins/pty/pty/tools/list.ts` (PTY fix) сохранён — это исправление только в working tree, не в stash
  5. Проверить что `tsconfig.json` (с exclude fix) сохранён — тоже только в working tree
  6. Финальный `git status` — посмотреть сколько файлов staged, сколько modified, сколько untracked

  **QA Scenarios**:
  - `git stash pop` выполнен (может быть с конфликтами, это нормально)
  - Все 19 конфликтов разрешены (проверить `git diff --name-only --diff-filter=U` — должен быть пуст)
  - 156 stash-only файлов применены без ошибок
  - PTY fix (`src/internals/plugins/pty/pty/tools/list.ts`) сохранён: содержит `ToolDefinition` type annotation
  - tsconfig fix сохранён: содержит `"node_modules/effect"` в exclude

- [ ] 4. Проверить и добавить 65 untracked-файлов

  **What to do**:
  1. `git ls-files --others --exclude-standard` — получить список всех untracked
  2. Проверить что ключевые директории присутствуют:
     - `src/agents/manager/` (должно быть 6 файлов: index.ts, agent.ts, default-prompt-sections.ts, etc.)
     - `src/hooks/manager/` (должно быть 24 файла — полная замена src/hooks/guard/)
     - `src/tools/call-hiai-agent/` (должно быть 16 файлов)
     - `src/tools/agent-browser/` (должно быть 5 файлов)
     - `src/hooks/mempalace-auto-save/` (должно быть 4 файла)
     - `src/agents/writer.ts`, `src/agents/builtin-agents/manager-agent.ts`
     - `src/features/builtin-skills/skills/` (новые builtin skills)
     - `src/config/schema/hiai-opencode-config.ts`
  3. Проверить что старые файлы ОТСУТСТВУЮТ (подтверждение что рефакторинг корректен):
     - `src/hooks/guard/` — НЕ должен существовать (заменён на manager/)
     - `src/agents/guard/` — НЕ должен существовать (заменён на manager/)
     - `src/agents/brainstormer.ts` — НЕ должен существовать (заменён на writer.ts)
     - `src/tools/call-omo-agent/` — НЕ должен существовать (заменён на call-hiai-agent/)
     - `src/config/schema/oh-my-opencode-config.ts` — НЕ должен существовать (заменён на hiai-opencode-config.ts)
  4. Выполнить `git add` для ВСЕХ untracked файлов

  **QA Scenarios**:
  - Все 6 ключевых директорий существуют с ожидаемым количеством файлов
  - Все 5 старых директорий/файлов отсутствуют
  - `git ls-files --others --exclude-standard` пуст после `git add`

---

### Wave 3: Verification — Проверка сборки и работоспособности

- [ ] 5. Запустить сборку и исправить ошибки

  **What to do**:
  1. Выполнить `rm -rf dist && bun run build`
  2. Если сборка падает:
     - Проверить ошибки — вероятнее всего `node_modules/effect` или PTY type errors
     - Убедиться что tsconfig.json содержит `"node_modules/effect"` в exclude
     - Убедиться что `src/internals/plugins/pty/pty/tools/list.ts` имеет явный type annotation
     - Если ошибки в новых файлах (manager, writer, call-hiai-agent) — исправить их
  3. Проверить что `dist/index.js` создан и имеет разумный размер (ожидается ~2.8 MB)
  4. Проверить что `dist/agents/manager/`, `dist/hooks/manager/`, `dist/tools/call-hiai-agent/` существуют

  **QA Scenarios**:
  - `bun run build` завершается с exit code 0
  - `dist/index.js` существует, размер > 2 MB
  - `dist/agents/manager/` содержит скомпилированные файлы Manager agent
  - `dist/hooks/manager/` содержит скомпилированные хуки Manager
  - `dist/tools/call-hiai-agent/` содержит скомпилированный call-hiai-agent

- [ ] 6. Запустить doctor и верифицировать агентов/MCP

  **What to do**:
  1. Выполнить `node assets/cli/hiai-opencode.mjs doctor` (локальная версия, не глобальный бинарник!)
  2. Проверить вывод:
     - Agent count and naming: visible=9 [Bob, Coder, Strategist, Manager, Critic, Designer, Researcher, Writer, Vision]
     - НЕ должно быть Guard или Brainstormer в списке агентов
     - Model slots configured: 10/10
  3. Проверить MCP servers (playwright, stitch, sequential-thinking, firecrawl, rag, mempalace, context7, websearch)
  4. Выполнить `opencode debug config` — убедиться что плагин загружается
  5. Выполнить `opencode mcp list` — убедиться что 8 MCP серверов connected

  **QA Scenarios**:
  - doctor показывает 9 agents, имена Manager и Writer (не Guard/Brainstormer)
  - doctor показывает ✅ для playwright, rag, firecrawl, mempalace, stitch, context7, sequential-thinking
  - `opencode debug config` показывает `"plugin": ["@hiai-gg/hiai-opencode@latest"]`
  - `opencode mcp list` показывает 9 MCP server(s) connected

- [ ] 7. Финальная интеграционная проверка

  **What to do**:
  1. Проверить что `.mcp.json` содержит правильные локальные пути (не Windows-пути)
  2. Проверить что `hiai-opencode.json` содержит правильные model keys (manager, writer — не guard, brainstormer)
  3. Проверить что `~/.config/opencode/opencode.json` указывает на `@hiai-gg/hiai-opencode@latest`
  4. Проверить что `AGENTS.md` обновлён (Guard→Manager, Brainstormer→Writer)
  5. Проверить что `README.md` и `ARCHITECTURE.md` обновлены

  **QA Scenarios**:
  - `.mcp.json` не содержит `C:\\Users\\` или других Windows-путей
  - `hiai-opencode.json` models секция содержит `"manager"` и `"writer"` (не guard/brainstormer)
  - `AGENTS.md` содержит Manager и Writer (не Guard и Brainstormer)

---

### Wave 4: Commit — Фиксация восстановленного рефакторинга

- [ ] 8. Закоммитить все изменения

  **What to do**:
  1. Убедиться что `git status` показывает staged changes (после разрешения конфликтов и git add)
  2. Проверить что нет lost файлов: `git status --short | grep "^ D"` — должен быть пуст
  3. Выполнить коммит с осмысленным сообщением:
     ```
     feat: major refactoring — Guard→Manager, Brainstormer→Writer, tools/hooks rename
     
     - Rename Guard agent to Manager across all files (~100+ files)
     - Rename Brainstormer agent to Writer across all files (~30+ files)
     - Rename call-omo-agent tool to call-hiai-agent (16 files)
     - New Manager hooks replacing Guard hooks (24 files)
     - New mempalace-auto-save hook (4 files)
     - New agent-browser tool (5 files)
     - New builtin skills (17 files)
     - Designer enhancement: Vision verification gate
     - Strategist enhancement: UI design pipeline
     - MCP config cleanup
     - Documentation updates
     
     Recovered from stash@{0} after git reset --hard operations on 2026-05-10.
     ```
  4. НЕ пушить (пока) — только локальный коммит

  **QA Scenarios**:
  - `git log -1 --oneline` показывает новый коммит
  - `git status` показывает "nothing to commit, working tree clean"
  - `git diff HEAD~1 --stat` показывает ~235 файлов изменено (175 из stash + 65 untracked минус overlap)

- [ ] 9. Финальная верификация чистоты репозитория

  **What to do**:
  1. `git status` — должно быть "nothing to commit, working tree clean"
  2. `git stash list` — stash должен быть пуст (потому что `pop`, не `apply`)
  3. Проверить что бэкап-ветка `backup/pre-recovery-2026-05-10` на месте (страховка)
  4. Финальный `bun run build` после коммита — убедиться что всё ещё работает
  5. Финальный `hiai-opencode doctor` — убедиться что всё ещё корректно

  **QA Scenarios**:
  - `git status` — "nothing to commit, working tree clean"
  - `git stash list` — пуст
  - `git branch` показывает `backup/pre-recovery-2026-05-10`
  - `bun run build` succeeds
  - `hiai-opencode doctor` показывает все ✅

---

## Final Verification Wave

После выполнения всех задач волн 1-4:

- [ ] FV-1. `git log --oneline -3` показывает новый коммит с рефакторингом
- [ ] FV-2. `bun run build` успешен (exit 0), dist/index.js > 2 MB
- [ ] FV-3. `node assets/cli/hiai-opencode.mjs doctor` — 9 agents, Manager/Writer, 8 MCP connected
- [ ] FV-4. `opencode debug config` — plugin loaded, agents: Bob, Coder, Strategist, Manager, Critic, Designer, Researcher, Writer, Vision
- [ ] FV-5. `opencode mcp list` — 9 MCP servers connected
- [ ] FV-6. Все старые имена (Guard, Brainstormer, call-omo-agent) отсутствуют в кодовой базе: `grep -r "guard" src/agents/types.ts src/config/` — не должно быть как agent name

## Commit Strategy

Один коммит со всеми изменениями:

```
feat: major refactoring — Guard→Manager, Brainstormer→Writer, tools/hooks rename

- Rename Guard agent to Manager across all files (~100+ files)
- Rename Brainstormer agent to Writer across all files (~30+ files)  
- Rename call-omo-agent tool to call-hiai-agent (16 files)
- New Manager hooks replacing Guard hooks (24 files)
- New mempalace-auto-save hook (4 files)
- New agent-browser tool (5 files)
- New builtin skills (17 files)
- Designer enhancement: Vision verification gate
- Strategist enhancement: UI design pipeline
- MCP config cleanup
- Documentation updates (AGENTS.md, ARCHITECTURE.md, README.md)

Recovered from stash@{0} after git reset --hard operations on 2026-05-10.
```

## Success Criteria

- [ ] Все 175 файлов из stash применены (0 осталось в stash)
- [ ] Все 19 конфликтов разрешены
- [ ] Все 65 untracked-файлов добавлены и закоммичены
- [ ] `bun run build` успешен
- [ ] `hiai-opencode doctor` показывает 9 agents с правильными именами
- [ ] `opencode mcp list` показывает все MCP connected
- [ ] Рабочая директория чистая после коммита
- [ ] Старые имена (Guard, Brainstormer) отсутствуют в кодовой базе
- [ ] Бэкап-ветка создана для страховки
