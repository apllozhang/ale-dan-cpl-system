# ALE DAN CPL 系统 - 优化路线图

## 优先级说明
- **P0（关键）**：直接影响用户体验和业务流程的功能
- **P1（高）**：增强系统功能和用户体验的功能
- **P2（中）**：优化性能和稳定性的功能
- **P3（低）**：长期改进和扩展功能

---

## 第一阶段：权限管理和多用户协作（P0 - 1-2 周）

### 1.1 用户角色和权限系统
**目标**：实现基于角色的访问控制（RBAC）

**功能清单**：
- [ ] 定义用户角色：管理员、销售经理、销售代表、查看者
- [ ] 实现权限矩阵：
  - 管理员：全部权限（用户管理、数据导入、系统设置）
  - 销售经理：报价审批、数据查看、团队管理
  - 销售代表：创建报价、查看产品、提交审批
  - 查看者：只读权限
- [ ] 在 `drizzle/schema.ts` 中扩展 `user` 表：添加 `role` 和 `department` 字段
- [ ] 创建权限检查中间件（`server/middleware/permissions.ts`）
- [ ] 在所有 tRPC 过程中添加权限验证
- [ ] 编写权限测试用例

**数据库变更**：
```sql
ALTER TABLE users ADD COLUMN role ENUM('admin', 'manager', 'sales', 'viewer') DEFAULT 'viewer';
ALTER TABLE users ADD COLUMN department VARCHAR(100);
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
```

**后端实现**：
- 创建 `adminProcedure`、`managerProcedure`、`salesProcedure` 等权限过程
- 在 `server/routers.ts` 中为所有敏感操作添加权限检查

**前端实现**：
- 根据用户角色在导航菜单中显示/隐藏功能
- 禁用无权限的按钮和操作
- 显示权限不足提示

---

### 1.2 用户管理界面
**目标**：管理员可以管理系统用户

**功能清单**：
- [ ] 创建用户管理页面（`client/src/pages/UserManagement.tsx`）
- [ ] 实现用户列表展示：用户名、邮箱、角色、部门、状态、创建时间
- [ ] 实现添加用户功能：表单验证、密码生成、邮件通知
- [ ] 实现编辑用户功能：修改角色、部门、状态
- [ ] 实现删除用户功能：软删除、确认对话框
- [ ] 实现批量操作：批量修改角色、批量启用/禁用
- [ ] 添加搜索和过滤：按角色、部门、状态过滤

**后端 tRPC 过程**：
- `admin.users.list` - 获取用户列表（支持分页、过滤）
- `admin.users.create` - 创建用户
- `admin.users.update` - 更新用户信息
- `admin.users.delete` - 删除用户
- `admin.users.bulkUpdate` - 批量更新用户

---

### 1.3 用户活动日志
**目标**：记录用户操作，便于审计和追踪

**功能清单**：
- [ ] 创建 `audit_logs` 表：记录用户 ID、操作类型、资源、时间戳、详情
- [ ] 在关键操作中添加日志记录：
  - 登录/登出
  - 创建/修改/删除报价
  - 导入数据
  - 修改用户权限
  - 系统设置变更
- [ ] 创建活动日志查看页面（`client/src/pages/AuditLogs.tsx`）
- [ ] 实现日志搜索和过滤：按用户、操作类型、时间范围

**后端实现**：
- 创建日志记录函数（`server/utils/auditLog.ts`）
- 在所有关键操作中调用日志函数
- 创建 tRPC 过程获取日志列表

---

## 第二阶段：功能完整性优化（P0 - 2-3 周）

### 2.1 分类数据统计仪表板
**目标**：在首页显示产品分类统计和系统概览

**功能清单**：
- [ ] 创建统计数据表：`category_stats`（分类 ID、产品数量、最近更新时间）
- [ ] 实现统计数据更新逻辑（在数据导入时自动更新）
- [ ] 创建仪表板卡片组件：
  - 产品总数统计
  - 各分类产品数量卡片（8 个分类）
  - 最近更新时间
  - 数据导入统计
- [ ] 实现可视化图表：
  - 分类产品数量柱状图
  - 产品状态分布饼图（Standard、Contact、Custom）
  - 最近 30 天导入趋势图
- [ ] 创建仪表板页面（`client/src/pages/Dashboard.tsx`）

**后端 tRPC 过程**：
- `stats.getCategoryStats` - 获取分类统计数据
- `stats.getSystemOverview` - 获取系统概览数据
- `stats.getImportHistory` - 获取导入历史统计

**前端实现**：
- 使用 Recharts 或 Chart.js 绘制图表
- 实现数据刷新功能
- 添加导出统计报告功能

---

### 2.2 产品数据导入日志系统
**目标**：记录所有数据导入操作，便于追踪和问题排查

**功能清单**：
- [ ] 创建 `import_logs` 表：
  - 导入 ID、用户 ID、导入时间、文件名、文件大小
  - 导入状态（成功、部分失败、失败）
  - 导入统计（新增、更新、删除、失败数量）
  - 失败详情（JSON 格式）
- [ ] 在数据导入流程中记录日志
- [ ] 创建导入日志查看页面（`client/src/pages/ImportLogs.tsx`）
- [ ] 实现日志详情查看：
  - 导入摘要信息
  - 失败项列表（可导出）
  - 导入前后数据对比
- [ ] 实现日志搜索和过滤：按导入时间、用户、状态

**后端实现**：
- 修改 `server/routers.ts` 中的导入过程，添加日志记录
- 创建 tRPC 过程获取导入日志列表和详情
- 实现失败项导出功能

**前端实现**：
- 导入成功后显示导入摘要
- 创建导入日志查看界面
- 实现失败项导出

---

### 2.3 报价单高级功能
**目标**：增强报价单的功能和用户体验

**功能清单**：
- [ ] 报价模板功能：
  - 保存当前报价为模板
  - 从模板创建新报价
  - 管理模板列表（编辑、删除、共享）
- [ ] 报价对比功能：
  - 选择两个报价进行对比
  - 显示产品、数量、价格差异
  - 生成对比报告
- [ ] 报价版本管理：
  - 记录报价修改历史
  - 支持恢复到历史版本
  - 显示版本变更记录
- [ ] 批量操作增强：
  - 批量修改产品数量或折扣
  - 批量删除产品
  - 批量添加产品
- [ ] 报价分享功能：
  - 生成报价分享链接
  - 支持设置过期时间和访问密码
  - 查看分享统计（查看次数、最后查看时间）

**数据库变更**：
```sql
CREATE TABLE quotation_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  items JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE quotation_versions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  quotation_id INT NOT NULL,
  version INT NOT NULL,
  items JSON NOT NULL,
  changed_by INT NOT NULL,
  change_description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id),
  FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE TABLE quotation_shares (
  id INT PRIMARY KEY AUTO_INCREMENT,
  quotation_id INT NOT NULL,
  share_token VARCHAR(255) UNIQUE NOT NULL,
  created_by INT NOT NULL,
  expires_at TIMESTAMP,
  password_hash VARCHAR(255),
  view_count INT DEFAULT 0,
  last_viewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

**后端 tRPC 过程**：
- `quotations.templates.list` - 获取模板列表
- `quotations.templates.create` - 创建模板
- `quotations.templates.delete` - 删除模板
- `quotations.compare` - 对比两个报价
- `quotations.versions.list` - 获取版本历史
- `quotations.versions.restore` - 恢复到历史版本
- `quotations.share.create` - 创建分享链接
- `quotations.share.view` - 查看分享的报价

---

## 第三阶段：用户体验优化（P1 - 2 周）

### 3.1 搜索和过滤增强
**目标**：提供更强大的搜索和过滤功能

**功能清单**：
- [ ] 高级搜索界面：
  - 多字段搜索（产品型号、说明、分类等）
  - 价格范围搜索
  - 状态过滤
  - 日期范围过滤
- [ ] 保存搜索条件：
  - 保存常用搜索条件为快捷方式
  - 快速应用保存的搜索
  - 管理保存的搜索列表
- [ ] 搜索建议和自动完成：
  - 基于历史搜索的建议
  - 产品型号自动完成
- [ ] 搜索结果优化：
  - 显示搜索相关性评分
  - 支持搜索结果排序
  - 显示搜索结果统计

**前端实现**：
- 创建高级搜索组件（`client/src/components/AdvancedSearch.tsx`）
- 实现搜索条件保存和加载
- 优化搜索结果展示

---

### 3.2 表格交互优化
**目标**：增强表格的交互体验

**功能清单**：
- [ ] 行内编辑功能：
  - 双击单元格进行编辑
  - 支持数量、折扣等字段快速修改
  - 按 Enter 保存，Escape 取消
- [ ] 快速复制功能：
  - 支持复制单个单元格
  - 支持复制整行
  - 支持复制选中的多行
- [ ] 键盘快捷键：
  - Ctrl+F：打开搜索
  - Ctrl+A：全选
  - Delete：删除选中行
  - Ctrl+C：复制
  - Ctrl+V：粘贴
- [ ] 表格导出增强：
  - 导出选中行
  - 导出过滤结果
  - 支持多种格式（Excel、CSV、PDF）
- [ ] 表格个性化：
  - 保存列宽和显示偏好
  - 支持冻结列
  - 支持行分组和汇总

**前端实现**：
- 增强现有表格组件
- 添加键盘事件监听
- 实现行内编辑功能
- 优化导出功能

---

### 3.3 移动端响应式设计
**目标**：优化移动设备上的用户体验

**功能清单**：
- [ ] 响应式布局调整：
  - 移动端隐藏不必要的列
  - 优化导航菜单（使用抽屉式菜单）
  - 调整卡片和表格的显示方式
- [ ] 触摸友好的交互：
  - 增大按钮和可点击元素的尺寸
  - 优化表单输入体验
  - 支持滑动操作（删除、编辑）
- [ ] 移动端特定功能：
  - 支持拍照上传文件
  - 支持语音输入搜索
  - 优化加载速度

**前端实现**：
- 使用 Tailwind 的响应式类
- 创建移动端特定组件
- 测试各种设备尺寸

---

### 3.4 深色/浅色主题切换
**目标**：提供主题选择功能，改善用户体验

**功能清单**：
- [ ] 实现主题切换功能：
  - 在用户设置中添加主题选择
  - 保存用户主题偏好到数据库
  - 支持系统默认主题
- [ ] 优化深色主题：
  - 调整颜色方案
  - 确保文本可读性
  - 优化图表颜色
- [ ] 主题过渡动画：
  - 平滑的颜色过渡
  - 避免闪烁

**前端实现**：
- 修改 `client/src/main.tsx` 中的 ThemeProvider
- 创建主题切换组件
- 保存主题偏好到 localStorage 和数据库

---

## 第四阶段：性能和稳定性优化（P2 - 1-2 周）

### 4.1 大数据集加载优化
**目标**：优化大数据集的加载和显示性能

**功能清单**：
- [ ] 虚拟滚动实现：
  - 在产品列表中实现虚拟滚动
  - 只渲染可见区域的行
  - 支持滚动到任意位置
- [ ] 分页优化：
  - 实现游标分页（而不是偏移分页）
  - 支持"加载更多"模式
  - 优化分页查询性能
- [ ] 数据预加载：
  - 预加载下一页数据
  - 支持无限滚动

**前端实现**：
- 使用 `react-window` 或 `react-virtualized` 库
- 优化分页逻辑
- 实现数据预加载

**后端实现**：
- 优化数据库查询
- 实现游标分页

---

### 4.2 缓存策略优化
**目标**：减少数据库查询，提高系统性能

**功能清单**：
- [ ] 产品数据缓存：
  - 缓存产品列表和详情
  - 设置合理的过期时间
  - 数据导入时清除缓存
- [ ] 搜索结果缓存：
  - 缓存常用搜索结果
  - 支持缓存失效
- [ ] 用户权限缓存：
  - 缓存用户角色和权限
  - 权限变更时清除缓存
- [ ] 客户端缓存：
  - 使用 localStorage 缓存用户偏好
  - 使用 IndexedDB 缓存产品数据

**后端实现**：
- 使用 Redis 或内存缓存
- 实现缓存失效策略
- 创建缓存管理工具

---

### 4.3 数据库查询优化
**目标**：提高数据库查询性能

**功能清单**：
- [ ] 索引优化：
  - 为常用查询字段添加索引
  - 分析慢查询日志
  - 优化复杂查询
- [ ] 查询性能分析：
  - 使用数据库分析工具
  - 识别性能瓶颈
  - 优化 N+1 查询问题
- [ ] 数据库连接池：
  - 配置连接池参数
  - 监控连接使用情况

**后端实现**：
- 添加数据库索引
- 优化 Drizzle ORM 查询
- 实现连接池管理

---

### 4.4 错误处理和日志系统
**目标**：完善错误处理和日志记录

**功能清单**：
- [ ] 统一错误处理：
  - 创建自定义错误类型
  - 实现全局错误处理中间件
  - 返回用户友好的错误信息
- [ ] 详细的日志记录：
  - 记录所有 API 请求和响应
  - 记录数据库操作
  - 记录系统错误和异常
- [ ] 日志查看界面：
  - 创建日志查看页面（仅管理员可访问）
  - 支持日志搜索和过滤
  - 实现日志导出功能
- [ ] 监控和告警：
  - 监控系统性能指标
  - 设置告警规则
  - 发送告警通知

**后端实现**：
- 创建日志工具（`server/utils/logger.ts`）
- 实现错误处理中间件
- 添加性能监控

---

## 实施时间表

| 阶段 | 功能 | 预计周期 | 优先级 |
|------|------|--------|--------|
| 第一阶段 | 权限管理和多用户协作 | 1-2 周 | P0 |
| 第二阶段 | 功能完整性优化 | 2-3 周 | P0 |
| 第三阶段 | 用户体验优化 | 2 周 | P1 |
| 第四阶段 | 性能和稳定性优化 | 1-2 周 | P2 |
| **总计** | **全部优化** | **6-9 周** | - |

---

## 技术栈和工具

### 前端增强
- **UI 组件**：shadcn/ui（已有）
- **图表库**：Recharts 或 Chart.js
- **虚拟滚动**：react-window
- **日期选择**：react-day-picker
- **表格增强**：TanStack Table（React Table）

### 后端增强
- **缓存**：Redis 或内存缓存
- **日志**：Winston 或 Pino
- **数据库**：Drizzle ORM（已有）+ MySQL/TiDB（已有）

### 测试
- **单元测试**：Vitest（已有）
- **集成测试**：Supertest
- **E2E 测试**：Playwright 或 Cypress

---

## 建议的实施顺序

1. **第一优先级**：权限管理系统（第一阶段）
   - 这是多用户协作的基础
   - 其他功能都依赖于权限系统

2. **第二优先级**：用户管理界面（第一阶段）
   - 完成权限系统后立即实施
   - 便于管理员管理用户

3. **第三优先级**：分类统计仪表板（第二阶段）
   - 提供系统概览
   - 提升用户体验

4. **第四优先级**：导入日志系统（第二阶段）
   - 完善数据管理
   - 便于问题追踪

5. **第五优先级**：报价高级功能（第二阶段）
   - 增强核心业务功能
   - 提高工作效率

6. **后续优先级**：用户体验和性能优化（第三、四阶段）
   - 基于用户反馈进行优化
   - 持续改进系统

---

## 下一步行动

请确认：
1. 是否同意这个优化路线图？
2. 是否需要调整优先级或功能范围？
3. 是否有其他特定需求或功能？
4. 是否需要立即开始第一阶段的实施？

确认后，我可以开始详细的需求分析和代码实施。
