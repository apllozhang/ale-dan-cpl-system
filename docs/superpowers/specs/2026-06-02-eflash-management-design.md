# eFlash 管理模块设计规格

## 概述

为 CPL 系统新增 eFlash 通知文档的导入、查询和管理功能。eFlash 是 ALE 的产品通知类文档，涵盖新产品发布（Phase-in）、产品停产（Phase-out）、服务变更、价格调整和中国区本地发布。

## 数据模型

### `eflash_records` — 主表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT AUTO_INCREMENT PK | 主键 |
| eflashId | VARCHAR(20) NOT NULL UNIQUE | 编号，如 EF-Z001、EF-N140、EF-C143 |
| type | ENUM('phase_in','phase_out','service','pricing','program') | eFlash 类型 |
| division | ENUM('communications','network','general') | 产品线 |
| scope | ENUM('global','china') | 全球/中国 |
| subjectEn | TEXT | 英文标题 |
| subjectCn | TEXT | 中文标题 |
| globalDate | DATE | 全球发布日期 |
| chinaDate | DATE | 中国发布日期 |
| effectiveDate | DATE | 生效日期 |
| authorEn | VARCHAR(200) | 英文版作者 |
| authorCn | VARCHAR(200) | 中文版译者/作者 |
| comments | TEXT | 备注 |
| createdBy | INT REFERENCES users(id) | 创建人 |
| createdAt | TIMESTAMP DEFAULT NOW() | 创建时间 |
| updatedAt | TIMESTAMP DEFAULT NOW() ON UPDATE | 更新时间 |

### `eflash_tags` — 标签字典表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT AUTO_INCREMENT PK | 主键 |
| name | VARCHAR(100) NOT NULL | 标签名称 |
| category | ENUM('region','product') | 标签类别：地区 or 产品 |
| createdAt | TIMESTAMP DEFAULT NOW() | 创建时间 |

约束：UNIQUE(name, category)

### `eflash_record_tags` — 记录-标签关联表

| 字段 | 类型 | 说明 |
|------|------|------|
| recordId | INT REFERENCES eflash_records(id) ON DELETE CASCADE | 记录 ID |
| tagId | INT REFERENCES eflash_tags(id) ON DELETE CASCADE | 标签 ID |

约束：PRIMARY KEY(recordId, tagId)

### `eflash_attachments` — 附件表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT AUTO_INCREMENT PK | 主键 |
| recordId | INT REFERENCES eflash_records(id) ON DELETE CASCADE | 关联记录 |
| fileName | VARCHAR(500) NOT NULL | 文件名 |
| filePath | VARCHAR(1000) NOT NULL | 文件路径 |
| fileSize | INT | 文件大小（bytes） |
| uploadedBy | INT REFERENCES users(id) | 上传人 |
| createdAt | TIMESTAMP DEFAULT NOW() | 上传时间 |

### 索引

- `eflash_records`: `(type)`, `(division)`, `(scope)`, `(effectiveDate)`, `UNIQUE(eflashId)`
- `eflash_tags`: `(category)`, `UNIQUE(name, category)`
- `eflash_record_tags`: `(tagId)`
- `eflash_attachments`: `(recordId)`

## 后端 API

### tRPC Router: `eflash`

#### 查询类（所有登录用户）

| 路由 | 输入 | 输出 | 说明 |
|------|------|------|------|
| `list` | `{ page?, pageSize?, type?, division?, scope?, dateFrom?, dateTo?, search?, tagIds? }` | `{ items: Record[], total: number }` | 分页列表，支持多维筛选 |
| `getById` | `{ id: number }` | `Record & { tags, attachments }` | 记录详情（含标签和附件） |
| `listTags` | `{ category? }` | `Tag[]` | 获取标签列表 |
| `getStats` | 无 | `{ byType: Record<string,number>, recentCount: number }` | 统计数据 |

#### 写入类（admin/sales_manager/superAdmin）

| 路由 | 输入 | 说明 |
|------|------|------|
| `create` | `{ eflashId, type, division, scope, subjectEn?, subjectCn?, globalDate?, chinaDate?, effectiveDate?, authorEn?, authorCn?, comments?, tagIds? }` | 创建记录 |
| `update` | `{ id, ...partial fields, tagIds? }` | 更新记录 |
| `delete` | `{ id }` | 删除记录（级联删除标签关联和附件文件） |
| `importExcel` | `{ fileBase64: string, sheetNames?: string[] }` | Excel 批量导入 |
| `uploadAttachment` | FormData: `{ recordId, file }` | 上传 PDF 附件 |
| `deleteAttachment` | `{ id }` | 删除附件 |

### Excel 导入逻辑

1. 用 XLSX 库解析上传的 Excel 文件
2. 遍历指定 Sheet（默认 China、NET Global、COMM Global）
3. 按行解析，跳过空行和标题行（Row 0-1）
4. 自动识别规则：
   - eFlash ID 以 Z 开头 → scope=china
   - eFlash ID 以 N 开头 → division=network, scope=global
   - eFlash ID 以 C 开头 → division=communications, scope=global
   - eFlash Type 列：Phase-in → phase_in, Phase-out → phase_out, Service → service, Pricing → pricing, Program → program
5. 日期字段：Excel 数字日期 → JS Date 转换（也兼容字符串日期格式）
6. 去重：按 eflashId 检查，已存在则更新（upsert 语义）
7. 标签：从标题中提取产品关键词匹配已有标签，无匹配则忽略
8. 返回结果：`{ created: number, updated: number, failed: number, errors: Array<{row, reason}> }`

### PDF 附件存储

- 存储路径：`uploads/eflash/{eflashId}/{originalFilename}`
- 通过 Express static middleware 提供下载
- 上传接口使用 multipart/form-data，限制单文件 50MB
- 删除记录时同步删除文件

### 权限

- 查看类路由：`protectedProcedure`（所有登录用户）
- 写入类路由：新增 `EFLASH_MANAGE` 权限，赋予 admin、sales_manager、superAdmin

## 前端

### 页面：`/eflash`

**侧边栏导航：** 在现有菜单中添加「eFlash」入口，图标用 `Bell` 或 `Megaphone`。

### 页面布局

```
┌─────────────────────────────────────────────────────┐
│  eFlash 管理                              [新建] [导入▼] │
│                                                      │
│  [类型▼] [产品线▼] [范围▼] [日期范围] [🔍 搜索...]    │
│                                                      │
│  ┌──────────────────────────────────────────────────┐ │
│  │ ID      │类型  │产品线│范围│中文标题│生效日│标签│操作│ │
│  │ EF-Z001 │Phase │Comm │CN │...    │2020 │🇨🇳│👁 ✏ 🗑│ │
│  │ EF-N140 │Phase │Net  │GL │...    │2020 │🌐│👁 ✏ 🗑│ │
│  └──────────────────────────────────────────────────┘ │
│  [< 1 2 3 ... >]                                     │
└─────────────────────────────────────────────────────┘
```

### 组件拆分

| 组件 | 说明 |
|------|------|
| `EFlashPage.tsx` | 页面容器，管理筛选状态和布局 |
| `EFlashTable.tsx` | 数据表格，含简略信息和操作按钮 |
| `EFlashDetailSheet.tsx` | 右侧抽屉，展示完整详情 |
| `EFlashFormDialog.tsx` | 新建/编辑表单对话框 |
| `EFlashImportDialog.tsx` | Excel 批量导入对话框 |
| `EFlashPdfUploadDialog.tsx` | PDF 元数据提取对话框 |

### 交互细节

- **眼睛图标**：点击后在右侧打开 Sheet（抽屉），展示记录完整详情
- **标签多选**：使用 Popover + Command 组件（shadcn 风格），支持搜索已有标签 + 自由输入新建
- **Excel 导入**：拖拽上传区域，支持 .xlsx/.xls 格式，可选择要导入的 Sheet
- **PDF 上传**：拖拽上传区域，自动解析文件名中的 eFlash ID 尝试匹配

### i18n

6 种语言全量翻译（zh, zh-TW, en, ja, es, fr），翻译 key 前缀 `eflash.`。

## Dashboard 集成

在首页仪表盘添加「近期 eFlash」卡片，展示最近 30 天的 eFlash 记录数量和最新 5 条，类似现有的 `ExpiringCertsCard`。

## 文件变更清单

### 新增文件

- `drizzle/0XXX_add_eflash_tables.sql` — 数据库迁移
- `drizzle/schema.ts` 新增 4 张表定义
- `server/db/eflash.ts` — 数据库操作模块
- `server/routers/eflash.ts` — tRPC 路由
- `shared/const.ts` 新增 `EFLASH_MANAGE` 权限
- `client/src/pages/EFlashPage.tsx` — 页面
- `client/src/components/eflash/` — 6 个组件
- `client/src/i18n/locales/*.json` — 6 种语言翻译

### 修改文件

- `drizzle/meta/` — 迁移元数据
- `server/db/index.ts` — 导出 eflash 模块
- `server/routers.ts` — 注册 eflashRouter
- `client/src/App.tsx` — 添加 /eflash 路由
- `client/src/components/DashboardLayout.tsx` — 添加侧边栏菜单项
- `client/src/pages/DashboardPage.tsx` — 添加近期 eFlash 卡片
