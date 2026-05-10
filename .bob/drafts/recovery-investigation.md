# Draft: Расследование пропажи рефакторинга hiai-opencode

## Исходные данные
- Дата: 2026-05-10
- Проект: @hiai-gg/hiai-opencode
- Симптом: огромный рефакторинг (~175 файлов) пропал после `bun run build`

## Собранная информация

### Источник 1: История сессий OpenCode (15 сессий за день)
- Работа шла в течение всего дня (16:01 - 21:56 UTC)
- Множественные попытки сборки: часть успешные, часть провальные
- Провалы сборки вызваны ошибками в `node_modules/effect` и `src/internals/plugins/pty/`
- После каждой неудачной сборки делался `rm -rf dist`
- Глобальный бинарник `hiai-opencode` показывал старые имена агентов
- ВЫВОД: source-файлы целы, работа не пропала (поверхностный анализ)

### Источник 2: Git история (КЛЮЧЕВОЙ)
- **stash@{0}**: 175 файлов, +1409/-6285 строк, создан 2026-05-10 20:10:26
- **git reflog**: 5 hard reset'ов за день (12:38, 13:47, 17:56, 20:10:19, 20:10:26)
- **Working tree**: только 21 файл изменён (частичное восстановление)
- **Untracked files**: ~60 новых файлов (src/agents/manager/, src/hooks/manager/, src/tools/call-hiai-agent/, etc.)
- **Последний коммит**: 7f1f065 от 8 мая 2026 (feature/playwright-cli branch)
- Коммитов за 10 мая НЕТ

### Источник 3: MemPalace
- MemPalace пуст (0 drawers)
- RAG недоступен (localhost:9002 не отвечает)

### Источник 4: .bob/
- Директория `.bob/` не существует

## Структура потерянной работы (stash@{0})

### 56 файлов УДАЛЕНО:
- src/hooks/guard/ — все 19 файлов (заменены на src/hooks/manager/)
- src/agents/guard/ — 5 файлов (заменены на src/agents/manager/)
- src/tools/call-omo-agent/ — 16 файлов (заменены на call-hiai-agent/)
- assets/mcp/playwright.mjs, assets/mcp/rag.mjs
- src/agents/brainstormer.ts
- src/config/schema/oh-my-opencode-config.ts

### 119 файлов ИЗМЕНЕНО:
- Переименование Guard→Manager (~100+ файлов)
- Переименование Brainstormer→Writer (~30+ файлов)
- Улучшение Designer (Vision verification gate)
- Улучшение Strategist (UI design pipeline)
- Обновление MCP конфигурации
- Документация (AGENTS.md, ARCHITECTURE.md, README.md)

### ~60 НОВЫХ файлов (untracked):
- src/agents/manager/ (6 files)
- src/hooks/manager/ (24 files)
- src/tools/call-hiai-agent/ (16 files)
- src/tools/agent-browser/ (5 files)
- src/hooks/mempalace-auto-save/ (4 files)
- src/features/builtin-skills/skills/ (17 files)
- src/config/schema/hiai-opencode-config.ts
- src/agents/writer.ts, src/agents/builtin-agents/manager-agent.ts

## Ответы на вопросы пользователя

### 1. Куда делось?
В stash@{0}. Git автоматически сохранил все незакоммиченные изменения в stash
при выполнении hard reset. Также есть untracked файлы (новые), которые stash не трогает.

### 2. Почему?
5 hard reset'ов за день. Механизм:
a) Изменения вносились без коммитов
b) `git reset --hard HEAD` — вероятно triggered сборкой или хуками
c) Git auto-stash сохранил изменения перед reset'ом
d) После reset'а только 21 из 175 файлов были применены обратно
e) Остальные 154 файла остались в stash

### 3. Можно ли восстановить?
ДА. `git stash pop` восстановит все изменения из stash.

### 4. План восстановления
См. отдельный план.
