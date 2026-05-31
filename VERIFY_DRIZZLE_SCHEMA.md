# Drizzle Schema 同步验证和调试指南

本文档用于验证云端数据库表结构是否与 Drizzle schema 定义一致，以及如何调试导入问题。

---

## 第一步：检查 Drizzle Schema 定义

### 1.1 查看本地 Drizzle schema 定义

```bash
cd /项目路径
grep -A 10 "export const cplSheets" drizzle/schema.ts
```

**期望看到：**

```typescript
export const cplSheets = mysqlTable("cpl_sheets", {
  id: int("id").autoincrement().primaryKey(),
  importLogId: int("importLogId"),
  sheetName: varchar("sheetName", { length: 128 }).notNull(),
  displayOrder: int("displayOrder").notNull().default(0),
  productCount: int("productCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
```

---

## 第二步：检查云端数据库实际结构

### 2.1 查看 cpl_sheets 表的完整定义

```bash
mysql -u root -p ale_cpl -e "SHOW CREATE TABLE cpl_sheets\G"
```

**期望输出：**

```
*************************** 1. row ***************************
       Table: cpl_sheets
Create Table: CREATE TABLE `cpl_sheets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `importLogId` int DEFAULT NULL,
  `sheetName` varchar(128) NOT NULL,
  `displayOrder` int NOT NULL DEFAULT '0',
  `productCount` int NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `cpl_sheets_importLogId_idx` (`importLogId`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

### 2.2 重点确认以下字段

| 字段 | 期望值 | 说明 |
|------|--------|------|
| `id` | `int NOT NULL AUTO_INCREMENT` | 主键，自动递增 |
| `importLogId` | `int DEFAULT NULL` | 可为空的外键 |
| `sheetName` | `varchar(128) NOT NULL` | 非空字符串 |
| `displayOrder` | `int NOT NULL DEFAULT '0'` | 默认值为 0 |
| `productCount` | `int NOT NULL DEFAULT '0'` | 默认值为 0 |
| `createdAt` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP` | 创建时间戳 |
| `updatedAt` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` | 更新时间戳 |

---

## 第三步：对比本地和云端结构

### 3.1 导出本地表结构

```bash
cd /项目路径
mysql -u root -p ale_cpl -e "SHOW CREATE TABLE cpl_sheets\G" > local_schema.txt
```

### 3.2 导出云端表结构

```bash
# 在云端执行
mysql -u root -p ale_cpl -e "SHOW CREATE TABLE cpl_sheets\G" > cloud_schema.txt
```

### 3.3 对比两个文件

```bash
diff local_schema.txt cloud_schema.txt
```

如果有差异，说明云端表结构不是最新的。

---

## 第四步：同步 Drizzle Schema 到云端

如果发现表结构不匹配，执行以下步骤：

### 4.1 确保代码是最新的

```bash
cd /项目路径
git pull origin main
# 或
git pull user_github main
```

### 4.2 安装依赖

```bash
pnpm install
```

### 4.3 推送数据库迁移

```bash
pnpm db:push
```

**输出示例：**

```
✓ No pending migrations to apply.
```

或

```
✓ Applying 1 migration...
✓ Migration applied successfully.
```

### 4.4 验证表结构已更新

```bash
mysql -u root -p ale_cpl -e "SHOW CREATE TABLE cpl_sheets\G"
```

应该看到更新后的表结构。

---

## 第五步：检查所有相关表的结构

### 5.1 检查 import_logs 表

```bash
mysql -u root -p ale_cpl -e "SHOW CREATE TABLE import_logs\G"
```

**期望看到：**

```
CREATE TABLE `import_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fileName` varchar(256) NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '0',
  `sheetsCount` int NOT NULL DEFAULT '0',
  `productsCount` int NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

### 5.2 检查 cpl_products 表

```bash
mysql -u root -p ale_cpl -e "SHOW CREATE TABLE cpl_products\G"
```

应该包含 `importLogId` 字段和相应的索引。

### 5.3 检查 cpl_summary 表

```bash
mysql -u root -p ale_cpl -e "SHOW CREATE TABLE cpl_summary\G"
```

应该包含 `importLogId` 字段。

---

## 第六步：启用 DEBUG 日志进行调试

### 6.1 构建项目

```bash
cd /项目路径
pnpm build
```

### 6.2 启动服务并启用 DEBUG 日志

```bash
DEBUG=drizzle:* node dist/index.js
```

或

```bash
DEBUG=* node dist/index.js
```

**输出示例：**

```
[2026-05-31T12:00:00.000Z] drizzle:query SELECT `id` FROM `import_logs` ORDER BY `createdAt` DESC LIMIT 1
[2026-05-31T12:00:00.100Z] drizzle:query INSERT INTO `cpl_sheets` ...
```

### 6.3 触发导入操作

在另一个终端中，执行导入操作：

```bash
curl -X POST http://localhost:3000/api/trpc/cpl.import \
  -H "Content-Type: application/json" \
  -d '{"json":{"file":"path/to/file.xlsx"}}'
```

或通过 Web UI 上传文件。

### 6.4 收集完整错误日志

复制所有输出，包括：
- DEBUG 日志
- 错误信息
- 堆栈跟踪

---

## 第七步：常见问题排查

### 问题 1：表不存在

**症状：** `SHOW CREATE TABLE cpl_sheets` 返回 "Table 'ale_cpl.cpl_sheets' doesn't exist"

**原因：** 未执行 `pnpm db:push`

**解决：**
```bash
pnpm db:push
```

### 问题 2：字段类型不匹配

**症状：** `displayOrder` 类型是 `varchar` 而不是 `int`

**原因：** 表结构是旧版本

**解决：**
```bash
# 备份数据
mysqldump -u root -p ale_cpl cpl_sheets > cpl_sheets_backup.sql

# 删除表
mysql -u root -p ale_cpl -e "DROP TABLE cpl_sheets"

# 重新创建
pnpm db:push
```

### 问题 3：缺少 AUTO_INCREMENT

**症状：** `id` 列没有 AUTO_INCREMENT

**原因：** 表结构不完整

**解决：**
```bash
mysql -u root -p ale_cpl -e "ALTER TABLE cpl_sheets MODIFY id INT NOT NULL AUTO_INCREMENT"
```

### 问题 4：缺少默认值

**症状：** `displayOrder` 或 `productCount` 没有默认值

**原因：** 表结构不完整

**解决：**
```bash
mysql -u root -p ale_cpl -e "ALTER TABLE cpl_sheets MODIFY displayOrder INT NOT NULL DEFAULT 0"
mysql -u root -p ale_cpl -e "ALTER TABLE cpl_sheets MODIFY productCount INT NOT NULL DEFAULT 0"
```

### 问题 5：缺少时间戳默认值

**症状：** `createdAt` 或 `updatedAt` 没有 DEFAULT CURRENT_TIMESTAMP

**原因：** 表结构不完整

**解决：**
```bash
mysql -u root -p ale_cpl -e "ALTER TABLE cpl_sheets MODIFY createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"
mysql -u root -p ale_cpl -e "ALTER TABLE cpl_sheets MODIFY updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
```

---

## 第八步：一键诊断脚本

复制以下脚本到云端运行，诊断 Drizzle schema 同步问题：

```bash
#!/bin/bash
echo "========== Drizzle Schema 同步诊断 =========="
echo ""

DB_USER="root"
DB_PASS="你的密码"
DB_NAME="ale_cpl"

echo "--- cpl_sheets 表结构 ---"
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "SHOW CREATE TABLE cpl_sheets\G" 2>/dev/null || echo "表不存在"
echo ""

echo "--- cpl_sheets 字段详情 ---"
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "DESCRIBE cpl_sheets" 2>/dev/null || echo "表不存在"
echo ""

echo "--- import_logs 表结构 ---"
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "SHOW CREATE TABLE import_logs\G" 2>/dev/null || echo "表不存在"
echo ""

echo "--- cpl_products 表结构 ---"
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "SHOW CREATE TABLE cpl_products\G" 2>/dev/null || echo "表不存在"
echo ""

echo "--- cpl_summary 表结构 ---"
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "SHOW CREATE TABLE cpl_summary\G" 2>/dev/null || echo "表不存在"
echo ""

echo "--- 检查代码中的 Drizzle schema ---"
if [ -f drizzle/schema.ts ]; then
  echo "✓ drizzle/schema.ts 存在"
  echo ""
  echo "cplSheets 定义："
  grep -A 10 "export const cplSheets" drizzle/schema.ts
else
  echo "✗ drizzle/schema.ts 不存在"
fi
echo ""

echo "--- 检查迁移文件 ---"
if [ -d drizzle/migrations ]; then
  echo "最新的迁移文件："
  ls -lt drizzle/migrations/ | head -5
else
  echo "✗ drizzle/migrations 目录不存在"
fi
echo ""

echo "========== 诊断完成 =========="
```

---

## 第九步：启用详细日志调试导入

### 9.1 修改代码添加日志

在 `server/db/cpl.ts` 中的 `importCplOverwrite` 函数添加日志：

```typescript
export async function importCplOverwrite(sheets: SheetData[], fileName: string) {
  console.log(`[IMPORT] Starting import for file: ${fileName}`);
  console.log(`[IMPORT] Number of sheets: ${sheets.length}`);

  // 创建导入日志
  const importLogId = await createImportLogAndGetId(fileName);
  console.log(`[IMPORT] Created import log with ID: ${importLogId}`);

  // 在 transaction 中处理数据
  return await db.transaction(async (tx) => {
    console.log(`[IMPORT] Starting transaction for importLogId: ${importLogId}`);

    for (const sheet of sheets) {
      console.log(`[IMPORT] Processing sheet: ${sheet.sheetName}`);

      // 插入 sheets
      const sheetData = {
        importLogId,
        sheetName: sheet.sheetName,
        displayOrder: sheet.displayOrder,
        productCount: sheet.products.length,
      };
      console.log(`[IMPORT] Inserting sheet:`, sheetData);

      // ... 其他代码
    }

    console.log(`[IMPORT] Transaction completed successfully`);
  });
}
```

### 9.2 启动服务并查看日志

```bash
DEBUG=drizzle:* node dist/index.js 2>&1 | tee import_debug.log
```

### 9.3 触发导入并保存日志

```bash
# 触发导入
curl -X POST http://localhost:3000/api/trpc/cpl.import ...

# 日志已保存到 import_debug.log
cat import_debug.log
```

---

## 完整的调试流程

1. **第一步：检查表结构**
   ```bash
   mysql -u root -p ale_cpl -e "SHOW CREATE TABLE cpl_sheets\G"
   ```

2. **第二步：同步 schema**
   ```bash
   git pull origin main
   pnpm install
   pnpm db:push
   ```

3. **第三步：验证表结构**
   ```bash
   mysql -u root -p ale_cpl -e "SHOW CREATE TABLE cpl_sheets\G"
   ```

4. **第四步：构建项目**
   ```bash
   pnpm build
   ```

5. **第五步：启动调试**
   ```bash
   DEBUG=drizzle:* node dist/index.js
   ```

6. **第六步：触发导入**
   ```bash
   # 在另一个终端中上传文件或调用 API
   ```

7. **第七步：收集日志**
   ```bash
   # 复制所有输出并分析
   ```

---

## 相关命令速查

| 命令 | 说明 |
|------|------|
| `SHOW CREATE TABLE 表名\G` | 查看表的完整定义 |
| `DESCRIBE 表名` | 查看表的字段列表 |
| `pnpm db:push` | 推送 Drizzle schema 变更 |
| `pnpm db:generate` | 生成迁移文件 |
| `DEBUG=drizzle:* node dist/index.js` | 启用 Drizzle 调试日志 |
| `DEBUG=* node dist/index.js` | 启用所有调试日志 |
| `git pull origin main` | 拉取最新代码 |
| `pnpm build` | 构建项目 |

---

## 参考资源

- [Drizzle ORM 文档](https://orm.drizzle.team/)
- [Drizzle 迁移指南](https://orm.drizzle.team/docs/migrations)
- [MySQL 时间戳](https://dev.mysql.com/doc/refman/8.0/en/datetime.html)
- [AUTO_INCREMENT](https://dev.mysql.com/doc/refman/8.0/en/example-auto-increment.html)
