# 云端部署核查清单

本地环境运行正常，请按以下步骤逐一核查云端环境。

---

## 一、环境信息（本地参考值）

| 项目 | 本地值 | 云端实际值（请填写） |
|------|--------|---------------------|
| Node.js | v22.x | |
| pnpm | 10.x | |
| MySQL | 8.0 | |
| 操作系统 | Windows 10 | |

---

## 二、文件完整性

### 2.1 确认代码已拉取

```bash
cd /项目路径
git log --oneline -3
# 应该能看到最新提交：fix: 补全产品数据页面缺失的 i18n 翻译键
```

### 2.2 确认依赖已安装

```bash
pnpm install
# 确认 node_modules 存在
ls node_modules/.pnpm | head -5
```

---

## 三、环境变量

### 3.1 检查 .env 文件

```bash
cat .env
```

必须包含以下变量（值根据云端实际情况填写）：

```env
DATABASE_URL=mysql://用户名:密码@数据库地址:3306/ale_cpl
SESSION_SECRET=至少32位随机字符串
NODE_ENV=production
```

### 3.2 如果缺少 .env，创建一份

```bash
cp .env.example .env
# 然后编辑填入云端实际值
vi .env
```

---

## 四、数据库

### 4.1 测试连接

```bash
# 方法一：命令行直连
mysql -h 数据库地址 -u 用户名 -p密码 ale_cpl -e "SELECT 1 AS test"

# 方法二：用项目代码测试
node -e "
  import('mysql2/promise').then(async ({default: mysql}) => {
    const url = process.env.DATABASE_URL;
    if (!url) { console.log('FAIL: DATABASE_URL 未设置'); process.exit(1); }
    try {
      const conn = await mysql.createConnection(url);
      const [rows] = await conn.query('SELECT 1 AS test');
      console.log('DB 连接成功:', rows);
      await conn.end();
    } catch(e) {
      console.log('DB 连接失败:', e.message);
      process.exit(1);
    }
  });
"
```

### 4.2 检查表结构

```bash
mysql -h 数据库地址 -u 用户名 -p密码 ale_cpl -e "SHOW TABLES"
```

应该包含以下表（至少这些）：

```
users
organizations
user_groups
import_logs
cpl_sheets
cpl_products
cpl_summary
quotations
quotation_items
quotation_versions
activity_logs
templates
product_specs
spec_entries
customers
```

### 4.3 如果缺少表，执行迁移

```bash
pnpm db:push
```

---

## 五、构建 & 启动

### 5.1 构建

```bash
pnpm build
```

构建完成后确认产物存在：

```bash
ls -la dist/index.js          # 服务端入口
ls -la dist/public/index.html  # 前端页面
ls dist/public/assets/         # 前端静态资源（JS/CSS）
```

### 5.2 启动

```bash
pnpm start
```

或直接：

```bash
node dist/index.js
```

启动后观察控制台输出，应该看到：

```
Server running on http://0.0.0.0:3000
tRPC mounted at /api/trpc
```

### 5.3 常见启动失败原因

| 报错信息 | 原因 | 解决 |
|---------|------|------|
| `EADDRINUSE` | 端口被占用 | 换端口或杀进程：`kill $(lsof -t -i:3000)` |
| `connect ECONNREFUSED` | 数据库连不上 | 检查 DATABASE_URL、防火墙、MySQL 是否运行 |
| `Cannot find module` | 依赖没装 | `pnpm install` |
| `SESSION_SECRET is required` | 环境变量缺失 | 检查 .env |

---

## 六、端口 & 防火墙

### 6.1 确认端口监听

```bash
ss -tlnp | grep 3000
# 或
netstat -tlnp | grep 3000
```

应该看到 node 进程在监听。

### 6.2 防火墙

```bash
# Linux 防火墙
sudo ufw allow 3000
sudo ufw status

# 如果是云服务器（阿里云/腾讯云/AWS），还需在控制台安全组中放行 3000 端口
```

---

## 七、功能验证

服务启动后，逐项测试：

### 7.1 基础连通

```bash
# 服务端健康检查
curl http://localhost:3000/api/trpc/system.health

# 前端页面
curl -I http://localhost:3000/
# 应返回 200
```

### 7.2 登录测试

```bash
curl -X POST http://localhost:3000/api/trpc/auth.login \
  -H "Content-Type: application/json" \
  -d '{"json":{"username":"admin","password":"你的密码"}}'
# 应返回用户信息和 token
```

### 7.3 数据库读写

```bash
# 登录后获取 CPL 数据
curl http://localhost:3000/api/trpc/cpl.hasData \
  -H "Cookie: app_session_id=你的session"
# 应返回 {"result":{"data":{"hasData":true,"count":数字}}}
```

---

## 八、一键诊断脚本

复制以下内容直接在云端运行，输出结果发回：

```bash
#!/bin/bash
echo "========== 云端环境诊断 =========="
echo ""
echo "--- 系统信息 ---"
uname -a
echo "时间: $(date)"
echo "时区: $(timedatectl 2>/dev/null | grep 'Time zone' || date +%Z)"
echo ""

echo "--- Node.js ---"
node -v 2>/dev/null || echo "Node.js 未安装"
npm -v 2>/dev/null
pnpm -v 2>/dev/null || echo "pnpm 未安装"
echo ""

echo "--- 环境变量 ---"
if [ -f .env ]; then
  echo ".env 存在，变量数量: $(grep -c '=' .env)"
  echo "DATABASE_URL: $(grep DATABASE_URL .env | sed 's/\(mysql:\/\/[^:]*:\).*/\1***/')"
  echo "SESSION_SECRET: $(grep SESSION_SECRET .env | sed 's/=.*/=***/' | cut -c1-30)"
  echo "NODE_ENV: $(grep NODE_ENV .env)"
else
  echo ".env 文件不存在"
fi
echo ""

echo "--- 数据库连接 ---"
DB_URL=$(grep DATABASE_URL .env 2>/dev/null | cut -d= -f2-)
if [ -n "$DB_URL" ]; then
  mysql $(echo $DB_URL | sed 's|mysql://||' | sed 's|:| -p|' | sed 's|@| -h|' | sed 's|:.*||') -e "SELECT 1 AS db_test" 2>&1 || echo "mysql 命令行工具不可用，尝试 node 测试..."
else
  echo "无法获取 DATABASE_URL"
fi
echo ""

echo "--- 构建产物 ---"
ls -la dist/index.js 2>/dev/null || echo "dist/index.js 不存在，需要执行 pnpm build"
ls -la dist/public/index.html 2>/dev/null || echo "dist/public/index.html 不存在"
echo ""

echo "--- 端口监听 ---"
ss -tlnp 2>/dev/null | grep -E '3000|3001|3002' || echo "3000-3002 端口均未监听"
echo ""

echo "--- 磁盘空间 ---"
df -h / | tail -1
echo ""

echo "--- 内存 ---"
free -h | head -2
echo ""

echo "--- 最近日志（如果用 pm2）---"
pm2 logs --nostream --lines 20 2>/dev/null || echo "pm2 未运行"
echo ""
echo "========== 诊断结束 =========="
```

---

## 九、本地 vs 云端最常见差异

按出问题概率排序：

1. **.env 文件缺失或值错误** — 最常见，云端经常忘记配置
2. **数据库连不上** — 云端 MySQL 可能是内网地址，需确认安全组/白名单
3. **没有执行 pnpm build** — 云端拉了代码直接 pnpm start，但生产模式需要先构建
4. **Node 版本过低** — 本地 v22，云端可能是 v18，BigInt 和部分 ESM 语法不兼容
5. **防火墙/安全组未放行端口** — 本地无此限制
6. **内存不足** — Excel 导入大文件时可能 OOM，本地内存充足不容易触发
