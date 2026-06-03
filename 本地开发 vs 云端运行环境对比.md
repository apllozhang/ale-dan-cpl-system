# 本地开发 vs 云端运行环境对比

## 一、本地开发环境（Sandbox）

### 系统环境
| 项目 | 版本/配置 |
|------|---------|
| 操作系统 | Ubuntu 22.04 (Linux 6.1.102) |
| CPU架构 | x86_64 |
| 容器ID | 45e14affeeee |

### Node.js & 包管理
| 项目 | 版本 |
|------|------|
| Node.js | v22.13.0 |
| npm | 10.9.2 |
| pnpm | 10.4.1 |
| 包管理器 | pnpm@10.4.1 (指定) |

### 数据库
| 项目 | 配置 |
|------|------|
| 类型 | TiDB Cloud (MySQL 兼容) |
| 地域 | us-east-1 |
| 连接方式 | TCP 4000 |
| SSL | 启用 (rejectUnauthorized: true) |
| 连接字符串 | `mysql://user:pass@gateway05.us-east-1.prod.aws.tidbcloud.com:4000/database` |

### 开发工具链
| 工具 | 版本 | 用途 |
|------|------|------|
| TypeScript | 5.9.3 | 类型检查 |
| Vite | 7.1.7 | 前端构建 |
| esbuild | 0.25.0 | 后端打包 |
| tsx | 4.19.1 | TypeScript 运行时 |
| Drizzle ORM | 0.44.5 | 数据库 ORM |
| drizzle-kit | 0.31.4 | 数据库迁移 |
| Vitest | 2.1.4 | 单元测试 |
| Prettier | 3.6.2 | 代码格式化 |
| Tailwind CSS | 4.1.14 | 样式框架 |

### 前端框架
| 框架/库 | 版本 | 用途 |
|--------|------|------|
| React | 19.2.1 | UI 框架 |
| React DOM | 19.2.1 | DOM 渲染 |
| React Router (wouter) | 3.3.5 | 路由 |
| React Hook Form | 7.64.0 | 表单处理 |
| TanStack Query | 5.90.2 | 数据获取 |
| Framer Motion | 12.23.22 | 动画库 |
| GSAP | 3.15.0 | 高级动画 |
| Recharts | 2.15.2 | 图表库 |
| Radix UI | 最新 | UI 组件库 |

### 后端框架
| 框架/库 | 版本 | 用途 |
|--------|------|------|
| Express | 4.21.2 | Web 框架 |
| tRPC | 11.6.0 | RPC 框架 |
| SuperJSON | 1.13.3 | 序列化 |
| Jose | 6.1.0 | JWT 处理 |
| bcryptjs | 3.0.3 | 密码加密 |
| mysql2 | 3.15.0 | MySQL 驱动 |

### 文件处理
| 库 | 版本 | 用途 |
|----|------|------|
| xlsx | 0.18.5 | Excel 读写 |
| exceljs | 4.4.0 | Excel 生成 |
| jsPDF | 4.2.1 | PDF 生成 |
| jsPDF-autotable | 5.0.8 | PDF 表格 |
| file-saver | 2.0.5 | 文件下载 |

### 存储
| 库 | 版本 | 用途 |
|----|------|------|
| @aws-sdk/client-s3 | 3.693.0 | S3 客户端 |
| @aws-sdk/s3-request-presigner | 3.693.0 | S3 签名 |

### 国际化
| 库 | 版本 | 用途 |
|----|------|------|
| i18next | 26.3.0 | i18n 框架 |
| react-i18next | 17.0.8 | React i18n |

### 开发脚本
```bash
# 开发模式
npm run dev          # 启动开发服务器 (tsx watch)

# 构建
npm run build        # 前端 + 后端构建

# 运行
npm run start        # 生产环境运行

# 数据库
npm run db:push      # 数据库迁移

# 测试
npm run test         # 运行单元测试

# 检查
npm run check        # TypeScript 类型检查

# 格式化
npm run format       # 代码格式化
```

---

## 二、云端运行环境（Cloud Run）

### 系统环境
| 项目 | 配置 |
|------|------|
| 平台 | Google Cloud Run |
| 容器镜像 | Node-only 构建镜像 |
| CPU | 1 vCPU |
| 内存 | 512 MiB |
| 超时 | 180 秒 |
| 最小实例 | 0（冷启动） |
| 构建系统 | Cloud Build |

### Node.js 版本
| 项目 | 配置 |
|------|------|
| Node.js | 由 Cloud Run 提供的最新 LTS |
| npm | 随 Node.js 提供 |
| pnpm | 需要通过 npm 安装 |

### 数据库
| 项目 | 配置 |
|------|------|
| 类型 | TiDB Cloud (与本地相同) |
| 连接 | 通过 DATABASE_URL 环境变量 |
| 连接池 | 由 mysql2 管理 |

### 构建流程
```
1. 源代码上传
2. Cloud Build 执行
3. 前端构建 (Vite)
4. 后端打包 (esbuild)
5. Docker 镜像创建
6. 镜像推送到 Cloud Run
7. 服务部署
```

### 运行时限制
| 限制 | 值 |
|------|-----|
| 请求超时 | 180 秒 |
| 最大并发请求 | 80 (默认) |
| 内存限制 | 512 MiB |
| CPU 限制 | 1 vCPU |
| 磁盘空间 | /tmp 临时目录 |

### 不可用的功能
| 功能 | 原因 |
|------|------|
| Python | 非 Node-only 构建镜像 |
| Go | 非 Node-only 构建镜像 |
| 系统二进制文件 | 仅 npm 包可用 |
| 持久化进程 | 无法在请求外运行 |
| 后台任务 | 需要使用 Cloud Tasks 或 Pub/Sub |
| 固定 IP | 需要使用 Cloud NAT |

### 环境变量（自动注入）
```
BUILT_IN_FORGE_API_KEY      # Manus API 密钥
BUILT_IN_FORGE_API_URL      # Manus API 地址
JWT_SECRET                  # JWT 签名密钥
OAUTH_SERVER_URL            # OAuth 服务器地址
OWNER_NAME                  # 项目所有者名称
OWNER_OPEN_ID               # 项目所有者 ID
VITE_ANALYTICS_ENDPOINT     # 分析端点
VITE_ANALYTICS_WEBSITE_ID   # 网站 ID
VITE_APP_ID                 # 应用 ID
VITE_APP_LOGO               # 应用 Logo
VITE_APP_TITLE              # 应用标题
VITE_FRONTEND_FORGE_API_KEY # 前端 API 密钥
VITE_FRONTEND_FORGE_API_URL # 前端 API 地址
VITE_OAUTH_PORTAL_URL       # OAuth 门户地址
DATABASE_URL                # 数据库连接字符串
```

---

## 三、本地 vs 云端对比表

| 方面 | 本地开发 | 云端运行 |
|------|---------|---------|
| **操作系统** | Ubuntu 22.04 | Cloud Run 容器 |
| **Node.js** | v22.13.0 (固定) | 最新 LTS (浮动) |
| **包管理器** | pnpm 10.4.1 | npm (pnpm 需安装) |
| **CPU** | 无限制 | 1 vCPU |
| **内存** | 无限制 | 512 MiB |
| **磁盘** | 无限制 | /tmp 临时 |
| **超时** | 无限制 | 180 秒 |
| **并发** | 单进程 | 80+ 并发 |
| **数据库** | TiDB Cloud | TiDB Cloud (相同) |
| **Python** | ✅ 可用 | ❌ 不可用 |
| **系统工具** | ✅ 可用 | ❌ 仅 npm 包 |
| **后台进程** | ✅ 支持 | ❌ 不支持 |
| **固定 IP** | ✅ 支持 | ❌ 需 Cloud NAT |
| **冷启动** | N/A | ~5-10 秒 |
| **自动扩展** | N/A | ✅ 支持 |

---

## 四、开发工作流

### 本地开发流程
```
1. 修改代码
   ↓
2. tsx watch 自动重新加载
   ↓
3. Vite HMR 热更新前端
   ↓
4. 本地测试
   ↓
5. pnpm test 运行单元测试
   ↓
6. pnpm build 构建
   ↓
7. git push 提交
```

### 云端部署流程
```
1. git push 到 GitHub
   ↓
2. Manus 检测到提交
   ↓
3. Cloud Build 执行
   - npm install / pnpm install
   - pnpm build
   - Docker 镜像创建
   ↓
4. 镜像推送到 Cloud Run
   ↓
5. 服务部署
   ↓
6. 自动扩展处理流量
```

---

## 五、性能考虑

### 本地开发
- ✅ 快速反馈循环
- ✅ 完整的系统工具访问
- ✅ 无资源限制
- ❌ 无法测试冷启动
- ❌ 无法测试并发限制

### 云端运行
- ✅ 真实的生产环境
- ✅ 自动扩展
- ✅ 高可用性
- ❌ 冷启动延迟
- ❌ 内存/CPU 限制
- ❌ 180 秒超时限制

---

## 六、关键差异处理

### 1. 长时间运行的任务
**本地：** 可以运行任意长的后台任务
**云端：** 最多 180 秒，需要使用 Cloud Tasks 或 Cloud Scheduler

### 2. 文件存储
**本地：** 可以使用本地文件系统
**云端：** 只有 /tmp 临时目录，需要使用 S3 或 Cloud Storage

### 3. 系统命令
**本地：** 可以使用任何系统命令
**云端：** 仅 npm 包可用，不能使用系统二进制文件

### 4. 并发处理
**本地：** 单进程处理
**云端：** 自动扩展到多个容器实例

---

## 七、推荐做法

### 开发时
1. 使用本地 sandbox 进行快速迭代
2. 充分利用 tsx watch 和 Vite HMR
3. 定期运行 `pnpm test` 验证
4. 使用 `pnpm db:push` 管理数据库

### 部署前
1. 运行完整的测试套件
2. 构建并测试生产镜像
3. 检查环境变量配置
4. 验证数据库连接

### 生产环境
1. 监控 Cloud Run 日志
2. 设置告警规则
3. 定期检查性能指标
4. 计划定期更新

---

## 八、故障排查

### 本地开发问题
| 问题 | 解决方案 |
|------|---------|
| 模块找不到 | `pnpm install` |
| 类型错误 | `pnpm check` |
| 数据库连接失败 | 检查 DATABASE_URL |
| 端口被占用 | 修改端口或 kill 进程 |

### 云端部署问题
| 问题 | 解决方案 |
|------|---------|
| 构建失败 | 检查 Cloud Build 日志 |
| 启动失败 | 检查 Cloud Run 日志 |
| 超时错误 | 优化代码或使用异步任务 |
| 内存不足 | 优化代码或升级实例 |

---

## 总结

本项目采用 **Node.js 全栈架构**，本地和云端环境高度一致：

- **本地：** 完整的开发工具链，快速反馈
- **云端：** 生产级别的容器化部署，自动扩展

关键是理解 Cloud Run 的限制（180 秒超时、512 MiB 内存），在开发时避免使用不支持的功能（Python、系统工具等）。
