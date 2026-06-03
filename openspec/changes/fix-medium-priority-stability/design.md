## Architecture Decisions

### 1. 报价单号原子生成

**决策：** 使用数据库子查询 `SELECT MAX(seq) + 1` 嵌入 INSERT 语句

**替代方案：**
- Redis 序列器 — 需要额外依赖，当前项目无 Redis
- 独立序列表 + 原子 UPDATE — 多一次 DB 调用
- 应用层分布式锁 — 过于复杂

**选择理由：** `INSERT ... SELECT MAX+1` 是 MySQL 原生能力，零额外依赖，单条 SQL 原子执行。即使并发 100 个请求也不会重复。

**实现模式：**
```
INSERT INTO quotations (quotationNo, ...)
SELECT CONCAT('QT-', DATE_FORMAT(NOW(), '%Y%m%d'), '-', LPAD(COALESCE(MAX(seq), 0) + 1, 3, '0')), ...
FROM (SELECT CAST(SUBSTRING_INDEX(quotationNo, '-', -1) AS UNSIGNED) AS seq
      FROM quotations WHERE quotationNo LIKE 'QT-20260603-%') t
```

### 2. CPL API 鉴权级别选择

**决策：** 读操作改 `protectedProcedure`，写操作保持 `superAdminProcedure`

**理由：** CPL 数据是企业产品价格表，属于内部敏感数据。但读操作不需要管理员权限，任何登录用户（销售、经理）都应该能查看。只有导入（破坏性操作）需要超级管理员。

**端点分级：**
| 端点 | 当前 | 改为 | 理由 |
|------|------|------|------|
| sheets | public | protected | 内部数据 |
| products | public | protected | 内部数据 |
| productsByIds | public | protected | 内部数据 |
| exportProducts | public | protected | 5 万行导出需登录 |
| summary | public | protected | 内部数据 |
| activeImport | public | protected | 系统状态 |
| hasData | public | protected | 系统状态 |
| stats | public | protected | 统计数据 |
| import | superAdmin | superAdmin | 不变 |

### 3. 分页策略

**决策：** 对无界查询统一添加 limit，不改函数签名（向后兼容）

**分级：**
- `matchQuotationWithAllSpecs` — 限制返回 500 条（specs 单次匹配不会超过这个数）
- `getSavedSearches` — limit 100
- `getQuotationVersions` — limit 50
- `getAllOrganizations` / `getAllUserGroups` — limit 500（组织数有限）
- `getQuotationTemplates` — limit 100

### 4. 错误日志级别

**决策：** 全部使用 `console.warn`，不用 `console.error`

**理由：** 这些 catch 场景都不是致命错误（文件已删除、JSON 损坏、Excel 格式问题），warn 级别足够在日志中留下痕迹，又不会触发告警。
