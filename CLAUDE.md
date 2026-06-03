# CLAUDE.md

This file provides strict architectural guidelines, business rules, and context for Claude Code (claude.ai/code) when working in this repository.

## Project Overview

ALE DAN CPL System — a full-stack enterprise quotation management platform for DAN (Digital Age Networking) product pricing.

**Live site**: https://www.extremecloudiq.cn/
**Repo**: https://github.com/apllozhang/ale-dan-cpl-system

## AI Agent Directives & Coding Conventions

When writing or modifying code in this repository, you MUST adhere to the following strict rules:

1.  **TypeScript Strictness:** You are forbidden from using `any`. Always define explicit types or interfaces for new Drizzle schemas, tRPC routers, and React components.
2.  **Strict Boundaries:** The `client` folder MUST NOT import anything from the `server` folder. All shared logic, types, and permission matrices must reside in `@shared/`.
3.  **Data Fetching:** Strictly use the `@/lib/trpc` React Query hooks for all API interactions in the frontend. Do not use standard `fetch` or `axios`.
4.  **Localization (i18n):** DO NOT hardcode user-facing text in JSX. You must use `react-i18next` and the `useTranslation()` hook (locales: zh, zh-TW, en, ja, es, fr).
5.  **UI/Styling:** Strictly utilize existing Tailwind utility classes and GSAP for animations (`@gsap/react`). Do not introduce new external CSS files or UI animation libraries unless explicitly requested.

## Commands

```bash
pnpm dev          # Start dev server (tsx watch, auto port detection starting 3000)
pnpm build        # Production build (vite build + esbuild server bundle)
pnpm start        # Run production server from dist/
pnpm check        # TypeScript type checking (tsc --noEmit)
pnpm test         # Run vitest (server tests only)
pnpm format       # Prettier format all files
pnpm db:push      # Generate + apply Drizzle migrations
```

Run a single test: `pnpm vitest run server/quotations.analytics.test.ts`

## Architecture

### Monorepo Structure

Single repo with shared TypeScript — no workspaces. Both client and server reference `@shared/*` via path aliases.

```
client/src/        → React frontend (Vite serves in dev, builds to dist/public)
server/            → Express + tRPC backend
shared/            → Shared types, constants, permission matrix
drizzle/           → DB schema (schema.ts) and migrations
```

### Path Aliases (tsconfig + vite + vitest)

- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

### Backend (server/)

- **Entry**: `server/_core/index.ts` — Express server with auto port detection (3000-3019), tRPC mounted at `/api/trpc`
- **tRPC setup**: `server/_core/trpc.ts` — procedure hierarchy: `publicProcedure` → `protectedProcedure` → `adminProcedure` → `superAdminProcedure` + `permissionProcedure(perm)` factory
- **Context/auth**: `server/_core/context.ts` — cookie-based session (`app_session_id`), JWT verification
- **Business logic**: `server/db.ts` — thin re-export of `server/db/index.ts` which aggregates 14 modular files (users, organizations, userGroups, cpl, importLogs, quotations, activityLogs, templates, versions, searches, suggestions, sharing, productSpecs, customers). **Critical**: `db.execute(rawSQL)` returns `[rows, fields]` tuple in mysql2, always extract with `Array.isArray(result[0]) ? result[0] : result`
- **Routes**: `server/routers.ts` — thin entry point assembling `appRouter` from 16 modular routers in `server/routers/` (auth, organizations, userGroups, users, quotations, cpl, importLogs, activityLogs, templates, versions, sharing, searches, suggestions, productSpecs, customers). Shared helper `server/routers/helpers.ts` exports `logActivity`.

### Frontend (client/src/)

- **Routing**: Wouter (`client/src/App.tsx`) — `/login` outside DashboardLayout, all dashboard routes inside
- **State/data**: tRPC React Query hooks via `@/lib/trpc` — `trpc.quotations.list.useQuery()`, `trpc.quotations.create.useMutation()`, etc.
- **Auth**: `@/_core/hooks/useAuth` — wraps `trpc.auth.me` query + auto-redirect
- **Theme**: `@/contexts/ThemeContext` — adds/removes `dark` class on `<html>`. Login page overrides this to always stay light.
- **i18n**: react-i18next with 6 locales in `client/src/i18n/locales/` (zh, zh-TW, en, ja, es, fr). All UI text goes through `useTranslation()`.
- **Animations**: GSAP (`gsap` + `@gsap/react`) for login carousel and entrance animations. Framer Motion available but GSAP is primary.

### Database

- **MySQL 8** via Drizzle ORM, connection string in `DATABASE_URL` env var
- **Schema**: `drizzle/schema.ts` — 13+ tables including `users`, `quotations`, `quotation_items`, `quotation_versions`, `cpl_products`, `organizations`, `user_groups`
- **Key schema details**:
  - Users have `role` enum (user/admin/sales_manager/sales_rep/viewer) + `isSuperAdmin` boolean
  - Quotations have version tracking: `quotations.version` (int), `quotation_versions.snapshot` (JSON text)
  - Permission matrix defined in `shared/const.ts` (`ROLE_PERMISSIONS` map)

### Discount Calculation

Discount rate is a direct multiplier: `subtotal = unitPrice × quantity × (discountRate / 100)`. So 10% discount means multiply by 0.1. This formula must be consistent across `server/routers/quotations.ts` (update mutation), `client/src/pages/QuotationDetail.tsx`, and `client/src/lib/quotationExportPro.ts`.

### Version Tracking

Quotation versioning is automatic on every save (`updateQuotation` in `server/db.ts`):
1. Snapshot current items/state as JSON before update
2. Compute diff (added/removed/modified products by `productModel`)
3. Store in `quotation_versions` with change summary
4. Frontend `VersionTimeline` component in `QuotationDetail.tsx` shows history and supports two-version diff comparison

## Environment

- **Platform**: Windows (use Unix shell syntax in bash, forward slashes in paths)
- **Git proxy**: `git config http.proxy http://127.0.0.1:10808` (if needed)
- **Database**: `mysql://root:@localhost:3306/ale_cpl` (default .env)
- **Node**: ES modules (`"type": "module"` in package.json)

## Development Workflow

1. **Type check**: `pnpm check` — run tsc before committing
2. **Tests**: `pnpm test` — 57 tests across 8 files covering discount calc, version diff, permissions, auth, analytics, import switching
3. **Auto-format**: `.claude/settings.json` PostToolUse hook runs prettier + eslint on every `.ts`/`.tsx` edit
4. **Key test files**:
   - `server/discount.test.ts` — discount calculation (rate / 100 formula)
   - `server/version-diff.test.ts` — quotation version diff detection (handles type mismatches)
   - `server/permissions.test.ts` — role/permission matrix validation
   - `server/cpl.test.ts` — auth login/logout, CPL data endpoints
   - `server/quotations.analytics.test.ts` — analytics queries
   - `server/quotations.exportExcel.test.ts` — Excel export logic

## Security Notes

- Quotation mutations (update/updateStatus/delete) verify ownership: only creator or admin/sales_manager/superAdmin can mutate
- `isSuperAdmin` flag only modifiable by existing super admins
- Login input capped at 128 chars (bcrypt DoS prevention)
- Excel import base64 capped at 50MB
- Super admin passwords are immutable via API

## Skill Routing Rules

三工具串行协作，禁止重叠调用：

| 阶段 | 工具 | 职责 | 何时触发 |
|------|------|------|----------|
| **决策** | gstack | 判断"做什么"——用 `/browse`、`/qa`、`/investigate`、`/health` 等收集证据，输出明确结论 | 任何任务的第一步 |
| **提案** | OpenSpec (`/opsx:propose`) | 把决策写成结构化 change proposal——`/opsx:explore` 探索 → `/opsx:propose` 提案 → `/opsx:apply` 执行 | 决策完成后、动手写码之前 |
| **执行** | Superpowers | 按 spec 写码——`/brainstorming` → `/writing-plans` → `/test-driven-development` → `/verification-before-completion` | spec 批准后 |

**禁止规则：**
- 不要同时调用重叠的 brainstorm / planning 命令（如 gstack 的 `/autoplan` 和 superpowers 的 `/brainstorming`）。
- 每个阶段只激活一个工具集，完成后再进入下一阶段。
- 简单 bugfix / 单行改动可跳过 OpenSpec，直接走 Superpowers 的 `/systematic-debugging`。

## gstack

gstack plugin installed at `~/.claude/skills/gstack`. Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy, /canary, /benchmark, /browse, /open-gstack-browser, /qa, /qa-only, /design-review, /setup-browser-cookies, /setup-deploy, /retro, /investigate, /document-release, /codex, /cso, /autoplan, /pair-agent, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade, /learn.

<!-- superpowers-zh:begin (do not edit between these markers) -->
# Superpowers-ZH 中文增强版

本项目已安装 superpowers-zh 技能框架（20 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 可用 Skills

Skills 位于 `.claude/skills/` 目录，每个 skill 有独立的 `SKILL.md` 文件。

- **brainstorming**: 在任何创造性工作之前必须使用此技能——创建功能、构建组件、添加功能或修改行为。在实现之前先探索用户意图、需求和设计。
- **chinese-code-review**: 中文 review 沟通参考——话术模板、分级标注（必须修复/建议修改/仅供参考）、国内团队常见反模式应对。仅在用户显式 /chinese-code-review 时调用，不要根据上下文自动触发。
- **chinese-commit-conventions**: 中文 commit 与 changelog 配置参考——Conventional Commits 中文适配、commitlint/husky/commitizen 中文模板、conventional-changelog 中文配置。仅在用户显式 /chinese-commit-conventions 时调用，不要根据上下文自动触发。
- **chinese-documentation**: 中文文档排版参考——中英文空格、全半角标点、术语保留、链接格式、中文文案排版指北约定。仅在用户显式 /chinese-documentation 时调用，不要根据上下文自动触发。
- **chinese-git-workflow**: 国内 Git 平台配置参考——Gitee、Coding.net、极狐 GitLab、CNB 的 SSH/HTTPS/凭据/CI 接入差异与镜像同步配置。仅在用户显式 /chinese-git-workflow 时调用，不要根据上下文自动触发。
- **dispatching-parallel-agents**: 当面对 2 个以上可以独立进行、无共享状态或顺序依赖的任务时使用
- **executing-plans**: 当你有一份书面实现计划需要在单独的会话中执行，并设有审查检查点时使用
- **finishing-a-development-branch**: 当实现完成、所有测试通过、需要决定如何集成工作时使用——通过提供合并、PR 或清理等结构化选项来引导开发工作的收尾
- **mcp-builder**: MCP 服务器构建方法论 — 系统化构建生产级 MCP 工具，让 AI 助手连接外部能力
- **receiving-code-review**: 收到代码审查反馈后、实施建议之前使用，尤其当反馈不明确或技术上有疑问时——需要技术严谨性和验证，而非敷衍附和或盲目执行
- **requesting-code-review**: 完成任务、实现重要功能或合并前使用，用于验证工作成果是否符合要求
- **subagent-driven-development**: 当在当前会话中执行包含独立任务的实现计划时使用
- **systematic-debugging**: 遇到任何 bug、测试失败或异常行为时使用，在提出修复方案之前执行
- **test-driven-development**: 在实现任何功能或修复 bug 时使用，在编写实现代码之前
- **using-git-worktrees**: 当需要开始与当前工作区隔离的功能开发，或在执行实现计划之前使用——通过原生工具或 git worktree 回退机制确保隔离工作区存在
- **using-superpowers**: 在开始任何对话时使用——确立如何查找和使用技能，要求在任何响应（包括澄清性问题）之前调用 Skill 工具
- **verification-before-completion**: 在宣称工作完成、已修复或测试通过之前使用，在提交或创建 PR 之前——必须运行验证命令并确认输出后才能声称成功；始终用证据支撑断言
- **workflow-runner**: 在 Claude Code / OpenClaw / Cursor 中直接运行 agency-orchestrator YAML 工作流——无需 API key，使用当前会话的 LLM 作为执行引擎。当用户提供 .yaml 工作流文件或要求多角色协作完成任务时触发。
- **writing-plans**: 当你有规格说明或需求用于多步骤任务时使用，在动手写代码之前
- **writing-skills**: 当创建新技能、编辑现有技能或在部署前验证技能是否有效时使用

## 如何使用

当任务匹配某个 skill 时，使用 `Skill` 工具加载对应 skill 并严格遵循其流程。绝不要用 Read 工具读取 SKILL.md 文件。

如果你认为哪怕只有 1% 的可能性某个 skill 适用于你正在做的事情，你必须调用该 skill 检查。
<!-- superpowers-zh:end -->

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
