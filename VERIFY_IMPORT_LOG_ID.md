# importLogId 有效性验证指南

本文档用于验证 importLogId 是否正确生成，以及是否存在于 import_logs 表中。

---

## 第一步：检查 import_logs 表中最近的记录

```bash
mysql -u root -p ale_cpl -e "SELECT id, fileName, isActive, createdAt FROM import_logs ORDER BY id DESC LIMIT 5"
```

**期望输出：**

```
id      fileName                    isActive  createdAt
300001  CPL_Product_Data_2026.xlsx  1         2026-05-31 12:00:00
300000  CPL_Product_Data_2026.xlsx  0         2026-05-31 11:00:00
299999  CPL_Product_Data_2026.xlsx  0         2026-05-31 10:00:00
...
```

**关键点：**
- `id` 应该是递增的整数
- `fileName` 应该与导入的文件名匹配
- `isActive` 应该是 1（最新导入）或 0（旧导入）
- `createdAt` 应该是导入时间

---

## 第二步：验证 importLogId 是否有效

如果导入失败并显示错误信息中的 `importLogId` 是 `300001`，需要验证这个 ID 是否存在：

```bash
mysql -u root -p ale_cpl -e "SELECT * FROM import_logs WHERE id = 300001"
```

**可能的结果：**

### 情况 A：ID 存在（正常）

```
id      fileName                    isActive  createdAt
300001  CPL_Product_Data_2026.xlsx  1         2026-05-31 12:00:00
```

**说明：** importLogId 有效，问题在其他地方。继续第三步。

### 情况 B：ID 不存在（异常）

```
(empty set)
```

**说明：** `createImportLogAndGetId` 返回了错误的 ID。继续第三步进行调试。

---

## 第三步：调试 createImportLogAndGetId 函数

### 3.1 查看最新的 import_logs 记录

```bash
mysql -u root -p ale_cpl -e "SELECT id, fileName, isActive, createdAt FROM import_logs ORDER BY createdAt DESC LIMIT 1"
```

这会显示最后一条插入的记录。

### 3.2 检查是否有孤立的 cpl_sheets 记录

如果 importLogId 不存在，可能有孤立的 sheets 记录：

```bash
mysql -u root -p ale_cpl -e "SELECT DISTINCT importLogId FROM cpl_sheets WHERE importLogId NOT IN (SELECT id FROM import_logs)"
```

**输出示例：**

```
importLogId
300001
300002
```

这些都是无效的 importLogId。

### 3.3 清理孤立记录

如果有孤立记录，需要清理：

```bash
# 备份数据
mysqldump -u root -p ale_cpl cpl_sheets > cpl_sheets_backup.sql

# 删除孤立记录
mysql -u root -p ale_cpl -e "DELETE FROM cpl_sheets WHERE importLogId NOT IN (SELECT id FROM import_logs)"

# 验证
mysql -u root -p ale_cpl -e "SELECT COUNT(*) FROM cpl_sheets"
```

---

## 第四步：检查外键约束

### 4.1 查看 cpl_sheets 的外键定义

```bash
mysql -u root -p ale_cpl -e "SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME='cpl_sheets' AND COLUMN_NAME='importLogId'"
```

**期望输出：**

```
CONSTRAINT_NAME              TABLE_NAME  COLUMN_NAME  REFERENCED_TABLE_NAME  REFERENCED_COLUMN_NAME
cpl_sheets_importLogId_fkey  cpl_sheets  importLogId  import_logs            id
```

### 4.2 如果外键不存在，添加外键

```bash
mysql -u root -p ale_cpl -e "ALTER TABLE cpl_sheets ADD CONSTRAINT cpl_sheets_importLogId_fkey FOREIGN KEY (importLogId) REFERENCES import_logs(id)"
```

---

## 第五步：验证导入流程中的 ID 生成

### 5.1 查看本地代码中的 createImportLogAndGetId 实现

```bash
cd /项目路径
grep -A 20 "createImportLogAndGetId" server/db/cpl.ts
```

**期望看到：**

```typescript
export async function createImportLogAndGetId(fileName: string) {
  const result = await db.insert(importLogs).values({
    fileName,
    isActive: true,
  });
  
  // 查询最新插入的记录
  const [latest] = await db.select().from(importLogs)
    .where(eq(importLogs.fileName, fileName))
    .orderBy(desc(importLogs.id))
    .limit(1);
  
  if (!latest?.id) {
    throw new Error("Failed to get insertId from import log creation");
  }
  
  return latest.id;
}
```

### 5.2 添加调试日志

如果 ID 生成有问题，可以在代码中添加调试日志：

```typescript
export async function createImportLogAndGetId(fileName: string) {
  console.log(`[DEBUG] Creating import log for file: ${fileName}`);
  
  const result = await db.insert(importLogs).values({
    fileName,
    isActive: true,
  });
  
  console.log(`[DEBUG] Insert result:`, result);
  
  const [latest] = await db.select().from(importLogs)
    .where(eq(importLogs.fileName, fileName))
    .orderBy(desc(importLogs.id))
    .limit(1);
  
  console.log(`[DEBUG] Latest record:`, latest);
  
  if (!latest?.id) {
    throw new Error("Failed to get insertId from import log creation");
  }
  
  console.log(`[DEBUG] Returning importLogId: ${latest.id}`);
  return latest.id;
}
```

---

## 第六步：一键诊断脚本

复制以下脚本到云端运行，诊断 importLogId 问题：

```bash
#!/bin/bash
echo "========== importLogId 诊断 =========="
echo ""

DB_USER="root"
DB_PASS="你的密码"
DB_NAME="ale_cpl"

echo "--- 最近的 import_logs 记录 ---"
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "SELECT id, fileName, isActive, createdAt FROM import_logs ORDER BY id DESC LIMIT 5" 2>/dev/null || echo "查询失败"
echo ""

echo "--- 最新的 import_logs 记录详情 ---"
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "SELECT * FROM import_logs ORDER BY createdAt DESC LIMIT 1" 2>/dev/null || echo "查询失败"
echo ""

echo "--- cpl_sheets 中的 importLogId 分布 ---"
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "SELECT importLogId, COUNT(*) as sheet_count FROM cpl_sheets GROUP BY importLogId ORDER BY importLogId DESC LIMIT 10" 2>/dev/null || echo "查询失败"
echo ""

echo "--- 孤立的 importLogId（不存在于 import_logs 中）---"
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "SELECT DISTINCT importLogId FROM cpl_sheets WHERE importLogId NOT IN (SELECT id FROM import_logs) LIMIT 10" 2>/dev/null || echo "没有孤立记录"
echo ""

echo "--- cpl_sheets 外键约束 ---"
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME='cpl_sheets' AND COLUMN_NAME='importLogId'" 2>/dev/null || echo "查询失败"
echo ""

echo "--- cpl_sheets 记录数 ---"
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "SELECT COUNT(*) as total_sheets FROM cpl_sheets" 2>/dev/null || echo "查询失败"
echo ""

echo "--- import_logs 记录数 ---"
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "SELECT COUNT(*) as total_imports FROM import_logs" 2>/dev/null || echo "查询失败"
echo ""

echo "========== 诊断完成 =========="
```

---

## 常见问题排查

### 问题 1：importLogId 返回值异常（如 300001）

**症状：** 导入失败，错误消息中的 importLogId 是一个很大的数字

**原因：** `createImportLogAndGetId` 返回了错误的值

**解决：**
1. 检查是否使用了正确的查询方式
2. 确保 Drizzle ORM 的查询返回了正确的记录
3. 添加日志调试

### 问题 2：外键约束错误

**症状：** 插入 cpl_sheets 时报错 "Foreign key constraint fails"

**原因：** importLogId 不存在于 import_logs 表中

**解决：**
1. 验证 importLogId 是否有效
2. 清理孤立记录
3. 检查外键约束是否正确

### 问题 3：import_logs 表为空

**症状：** `SELECT * FROM import_logs` 返回空结果

**原因：** 导入日志从未被创建过

**解决：**
1. 检查是否有导入错误
2. 查看应用日志
3. 尝试重新导入

### 问题 4：cpl_sheets 记录数与 import_logs 不匹配

**症状：** cpl_sheets 有很多记录，但 import_logs 很少

**原因：** 可能有多个导入日志，或者有孤立记录

**解决：**
```bash
# 统计每个 importLogId 对应的 sheets 数量
mysql -u root -p ale_cpl -e "SELECT importLogId, COUNT(*) as count FROM cpl_sheets GROUP BY importLogId"

# 找出无效的 importLogId
mysql -u root -p ale_cpl -e "SELECT DISTINCT importLogId FROM cpl_sheets WHERE importLogId NOT IN (SELECT id FROM import_logs)"
```

---

## 数据恢复步骤

如果导入失败导致数据不一致，可以按以下步骤恢复：

### 步骤 1：备份当前数据

```bash
mysqldump -u root -p ale_cpl > ale_cpl_backup_$(date +%Y%m%d_%H%M%S).sql
```

### 步骤 2：清理孤立记录

```bash
# 删除孤立的 cpl_sheets
mysql -u root -p ale_cpl -e "DELETE FROM cpl_sheets WHERE importLogId NOT IN (SELECT id FROM import_logs)"

# 删除孤立的 cpl_products
mysql -u root -p ale_cpl -e "DELETE FROM cpl_products WHERE importLogId NOT IN (SELECT id FROM import_logs)"

# 删除孤立的 cpl_summary
mysql -u root -p ale_cpl -e "DELETE FROM cpl_summary WHERE importLogId NOT IN (SELECT id FROM import_logs)"
```

### 步骤 3：验证数据一致性

```bash
# 检查是否还有孤立记录
mysql -u root -p ale_cpl -e "SELECT DISTINCT importLogId FROM cpl_sheets WHERE importLogId NOT IN (SELECT id FROM import_logs)"

# 应该返回空结果
```

### 步骤 4：重新导入

清理完成后，可以重新导入数据。

---

## 相关命令速查

| 命令 | 说明 |
|------|------|
| `SELECT * FROM import_logs ORDER BY id DESC LIMIT 5` | 查看最近的导入记录 |
| `SELECT * FROM import_logs WHERE id = 300001` | 查看特定 ID 的导入记录 |
| `SELECT DISTINCT importLogId FROM cpl_sheets` | 查看所有使用过的 importLogId |
| `SELECT DISTINCT importLogId FROM cpl_sheets WHERE importLogId NOT IN (SELECT id FROM import_logs)` | 找出孤立的 importLogId |
| `DELETE FROM cpl_sheets WHERE importLogId NOT IN (SELECT id FROM import_logs)` | 删除孤立记录 |
| `SELECT COUNT(*) FROM cpl_sheets` | 统计 sheets 总数 |
| `SELECT COUNT(*) FROM import_logs` | 统计导入日志总数 |
