# 数据库表结构验证指南

本文档用于验证云端数据库表结构是否与本地一致。

---

## 第一步：验证 cpl_sheets 表

### 1.1 检查表是否存在且结构正确

```bash
mysql -u root -p ale_cpl -e "DESCRIBE cpl_sheets"
```

**期望输出：**

```
Field          Type         Null  Key  Default
id             int          NO    PRI  NULL
importLogId    int          YES   MUL  NULL
sheetName      varchar(128) NO         NULL
displayOrder   int          NO         0
productCount   int          NO         0
createdAt      timestamp    NO         CURRENT_TIMESTAMP
updatedAt      timestamp    NO         CURRENT_TIMESTAMP
```

### 1.2 如果表不存在或字段不匹配

```bash
cd /项目路径
pnpm db:push
```

---

## 第二步：验证 cpl_products 表

```bash
mysql -u root -p ale_cpl -e "DESCRIBE cpl_products"
```

**期望输出：**

```
Field             Type         Null  Key  Default
id                int          NO    PRI  NULL
importLogId       int          YES   MUL  NULL
sheetName         varchar(128) NO         NULL
productGroup      text         YES        NULL
taxCategory       text         YES        NULL
productModel      varchar(256) YES        NULL
productDesc       text         YES        NULL
salesCategory     varchar(128) YES        NULL
serviceCategory   varchar(128) YES        NULL
productStatus     varchar(64)  YES        NULL
listPrice         varchar(64)  YES        NULL
priceNote         text         YES        NULL
isNew             varchar(64)  YES        NULL
remark            text         YES        NULL
createdAt         timestamp    NO         CURRENT_TIMESTAMP
updatedAt         timestamp    NO         CURRENT_TIMESTAMP
```

---

## 第三步：验证 cpl_summary 表

```bash
mysql -u root -p ale_cpl -e "DESCRIBE cpl_summary"
```

**期望输出：**

```
Field      Type         Null  Key  Default
id         int          NO    PRI  NULL
importLogId int         YES        NULL
content    text         NO         NULL
version    varchar(256) YES        NULL
importedAt timestamp    NO         CURRENT_TIMESTAMP
```

---

## 第四步：验证 import_logs 表

```bash
mysql -u root -p ale_cpl -e "DESCRIBE import_logs"
```

**期望输出：**

```
Field       Type         Null  Key  Default
id          int          NO    PRI  NULL
fileName    varchar(256) NO         NULL
status      varchar(32)  NO         pending
sheetsCount int          NO         0
productsCount int        NO         0
createdAt   timestamp    NO         CURRENT_TIMESTAMP
updatedAt   timestamp    NO         CURRENT_TIMESTAMP
```

---

## 第五步：验证所有表是否存在

```bash
mysql -u root -p ale_cpl -e "SHOW TABLES"
```

**期望输出应包含：**

```
Tables_in_ale_cpl
activities
activity_logs
cpl_products
cpl_sheets
cpl_summary
customers
discount_rules
import_logs
organizations
permissions
product_specs
quotation_items
quotation_versions
quotations
spec_entries
templates
user_groups
users
version_diffs
```

---

## 第六步：验证外键关系

```bash
mysql -u root -p ale_cpl -e "SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME='cpl_sheets'"
```

应该看到 `importLogId` 有对应的外键关系。

---

## 第七步：验证索引

```bash
mysql -u root -p ale_cpl -e "SHOW INDEXES FROM cpl_sheets"
```

**期望输出应包含：**

```
Table       Non_unique  Key_name                    Seq_in_index  Column_name
cpl_sheets  0           PRIMARY                     1             id
cpl_sheets  1           cpl_sheets_importLogId_idx  1             importLogId
```

---

## 常见问题排查

### 问题 1：表不存在

**症状：** `DESCRIBE cpl_sheets` 返回 "Table 'ale_cpl.cpl_sheets' doesn't exist"

**解决：**
```bash
pnpm db:push
```

### 问题 2：字段类型不匹配

**症状：** `displayOrder` 或 `productCount` 类型不是 `int`

**解决：**
```bash
# 备份数据
mysqldump -u root -p ale_cpl cpl_sheets > cpl_sheets_backup.sql

# 删除表
mysql -u root -p ale_cpl -e "DROP TABLE cpl_sheets"

# 重新创建
pnpm db:push
```

### 问题 3：字段缺少默认值

**症状：** `displayOrder` 或 `productCount` 的 `Default` 列为 `NULL` 而不是 `0`

**解决：**
```bash
mysql -u root -p ale_cpl -e "ALTER TABLE cpl_sheets MODIFY displayOrder INT NOT NULL DEFAULT 0"
mysql -u root -p ale_cpl -e "ALTER TABLE cpl_sheets MODIFY productCount INT NOT NULL DEFAULT 0"
```

### 问题 4：时间戳字段不正确

**症状：** `createdAt` 或 `updatedAt` 的类型是 `datetime` 而不是 `timestamp`

**解决：**
```bash
pnpm db:push
```

---

## 一键验证脚本

复制以下脚本到云端运行，检查所有表结构：

```bash
#!/bin/bash
echo "========== 数据库表结构验证 =========="
echo ""

DB_USER="root"
DB_PASS="你的密码"
DB_NAME="ale_cpl"

# 检查 cpl_sheets
echo "--- cpl_sheets 表结构 ---"
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "DESCRIBE cpl_sheets" 2>/dev/null || echo "表不存在"
echo ""

# 检查 cpl_products
echo "--- cpl_products 表结构 ---"
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "DESCRIBE cpl_products" 2>/dev/null || echo "表不存在"
echo ""

# 检查 cpl_summary
echo "--- cpl_summary 表结构 ---"
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "DESCRIBE cpl_summary" 2>/dev/null || echo "表不存在"
echo ""

# 检查 import_logs
echo "--- import_logs 表结构 ---"
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "DESCRIBE import_logs" 2>/dev/null || echo "表不存在"
echo ""

# 检查所有表
echo "--- 所有表列表 ---"
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "SHOW TABLES" 2>/dev/null || echo "无法连接数据库"
echo ""

# 检查 cpl_sheets 索引
echo "--- cpl_sheets 索引 ---"
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "SHOW INDEXES FROM cpl_sheets" 2>/dev/null || echo "表不存在"
echo ""

echo "========== 验证完成 =========="
```

---

## 本地验证（参考）

如果需要在本地验证表结构，可以运行：

```bash
cd /项目路径
pnpm db:push
```

然后检查 `drizzle/migrations/` 目录下的最新迁移文件。

---

## 相关命令速查

| 命令 | 说明 |
|------|------|
| `DESCRIBE 表名` | 查看表结构 |
| `SHOW TABLES` | 列出所有表 |
| `SHOW INDEXES FROM 表名` | 查看表的索引 |
| `SHOW CREATE TABLE 表名` | 查看表的完整 CREATE 语句 |
| `SELECT COUNT(*) FROM 表名` | 查看表中的记录数 |
| `pnpm db:push` | 推送本地 schema 变更到数据库 |
| `pnpm db:generate` | 生成迁移文件 |
