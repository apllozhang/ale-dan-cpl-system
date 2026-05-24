# ALE DAN CPL API 接口文档

> 基于 tRPC 的类型安全 API。tRPC 自动映射 HTTP 方法：`query` = GET，`mutation` = POST。

## 认证级别

| 级别 | 说明 |
|------|------|
| **Public** | 无需认证 |
| **Protected** | 需要登录（JWT Cookie） |
| **Admin** | 需要管理员角色 |

## 认证机制

- **Cookie 名**：`app_session_id`
- **Token 类型**：JWT (HS256)
- **有效期**：1 年
- **流程**：登录 → bcrypt 验证 → JWT 签发 → 写入 Cookie → 每次请求自动解析

---

## System 系统接口

### `system.health` — 健康检查

| 属性 | 值 |
|------|----|
| 认证 | Public |
| 类型 | Query |

**输入：**
```typescript
{
  timestamp: number  // >= 0
}
```

**输出：**
```typescript
{ ok: true }
```

---

### `system.notifyOwner` — 通知管理员

| 属性 | 值 |
|------|----|
| 认证 | Admin |
| 类型 | Mutation |

**输入：**
```typescript
{
  title: string    // 必填
  content: string  // 必填
}
```

**输出：**
```typescript
{ success: boolean }
```

---

## Auth 认证接口

### `auth.me` — 获取当前用户

| 属性 | 值 |
|------|----|
| 认证 | Public（未登录返回 null） |
| 类型 | Query |

**输入：** 无

**输出：**
```typescript
{
  id: number
  openId: string
  username?: string
  name?: string
  email?: string
  role: "user" | "admin"
  createdAt: string
  updatedAt: string
  lastSignedIn: string
} | null
```

---

### `auth.login` — 用户登录

| 属性 | 值 |
|------|----|
| 认证 | Public |
| 类型 | Mutation |

**输入：**
```typescript
{
  username: string
  password: string
}
```

**输出：**
```typescript
{
  success: boolean
  name?: string
}
```

**错误：** `UNAUTHORIZED` — "用户名或密码错误"

---

### `auth.logout` — 用户登出

| 属性 | 值 |
|------|----|
| 认证 | Public |
| 类型 | Mutation |

**输入：** 无

**输出：**
```typescript
{ success: true }
```

---

## Users 用户管理接口（仅管理员）

### `users.list` — 获取用户列表

| 属性 | 值 |
|------|----|
| 认证 | Admin |
| 类型 | Query |

**输入：** 无

**输出：** `User[]`（不含 passwordHash）

---

### `users.getById` — 获取单个用户

| 属性 | 值 |
|------|----|
| 认证 | Admin |
| 类型 | Query |

**输入：**
```typescript
{ id: number }
```

**输出：** `User | undefined`

---

### `users.create` — 创建用户

| 属性 | 值 |
|------|----|
| 认证 | Admin |
| 类型 | Mutation |

**输入：**
```typescript
{
  username: string    // 3-64 字符，必填
  password: string    // 最少 6 字符，必填
  name?: string
  email?: string      // 需符合邮箱格式
  role?: "user" | "admin"  // 默认 "user"
}
```

**输出：**
```typescript
{ id: number, username: string, ... }
```

**错误：** `CONFLICT` — "用户名已存在"

---

### `users.update` — 更新用户

| 属性 | 值 |
|------|----|
| 认证 | Admin |
| 类型 | Mutation |

**输入：**
```typescript
{
  id: number          // 必填
  username?: string   // 3-64 字符
  password?: string   // 最少 6 字符（会自动 rehash）
  name?: string
  email?: string
  role?: "user" | "admin"
}
```

**输出：** 更新后的 User 对象

**错误：** `CONFLICT` — "用户名已存在"

---

### `users.delete` — 删除用户

| 属性 | 值 |
|------|----|
| 认证 | Admin |
| 类型 | Mutation |

**输入：**
```typescript
{ id: number }
```

**输出：** 删除结果

---

## Quotations 报价单接口

### `quotations.list` — 报价单列表

| 属性 | 值 |
|------|----|
| 认证 | Protected |
| 类型 | Query |

**输入：**
```typescript
{
  search?: string          // 搜索报价单号、客户名、项目名
  status?: string          // 按状态筛选
  page?: number            // 页码，默认 1
  pageSize?: number        // 每页条数，默认 20，最大 100
  sortBy?: string          // 排序字段
  sortOrder?: "asc" | "desc"  // 默认 "desc"
}
```

**输出：** 分页报价单列表（含创建人信息）

**说明：** 普通用户只能看到自己创建的报价单，管理员可看全部。

---

### `quotations.getById` — 报价单详情

| 属性 | 值 |
|------|----|
| 认证 | Protected |
| 类型 | Query |

**输入：**
```typescript
{ id: number }
```

**输出：** 报价单对象（含所有行项目）

---

### `quotations.create` — 创建报价单

| 属性 | 值 |
|------|----|
| 认证 | Protected |
| 类型 | Mutation |

**输入：**
```typescript
{
  customerName: string         // 必填
  customerContact?: string
  customerPhone?: string
  customerEmail?: string
  projectName?: string
  discountRate?: number
  notes?: string
  validUntil?: string          // 日期字符串
  items: [{
    productId?: number
    productModel: string       // 必填
    productDesc?: string
    listPrice?: string
    quantity?: number           // 默认 1
    unitPrice?: number
    discountRate?: number
  }]
}
```

**输出：** 创建的报价单（自动生成编号 `QT-YYYYMMDD-NNN`）

---

### `quotations.update` — 更新报价单

| 属性 | 值 |
|------|----|
| 认证 | Protected |
| 类型 | Mutation |

**输入：** 与 create 相同，所有字段可选，`id` 必填。若提供 `items`，则替换所有行项目。

---

### `quotations.updateStatus` — 更新报价单状态

| 属性 | 值 |
|------|----|
| 认证 | Protected |
| 类型 | Mutation |

**输入：**
```typescript
{
  id: number
  status: "draft" | "submitted" | "approved" | "sent" | "completed" | "cancelled"
}
```

**状态流程：** `draft → submitted → approved → sent → completed/cancelled`

---

### `quotations.delete` — 删除报价单

| 属性 | 值 |
|------|----|
| 认证 | Protected |
| 类型 | Mutation |

**输入：**
```typescript
{ id: number }
```

---

## CPL 产品数据接口

### `cpl.sheets` — 获取所有产品系列

| 属性 | 值 |
|------|----|
| 认证 | Public |
| 类型 | Query |

**输入：** 无

**输出：** Sheet 元数据数组

---

### `cpl.products` — 产品列表（支持高级筛选）

| 属性 | 值 |
|------|----|
| 认证 | Public |
| 类型 | Query |

**输入：**
```typescript
{
  sheetNames?: string[]              // 按系列筛选（支持多个）
  search?: string                   // 全局搜索（模糊匹配所有文本字段）
  page?: number                     // 默认 1
  pageSize?: number                 // 默认 50，最大 200
  sortBy?: string                   // 排序字段
  sortOrder?: "asc" | "desc"       // 默认 "asc"
  filters?: Record<string, string>  // 列级别筛选
}
```

**输出：**
```typescript
{
  data: CplProduct[]
  total: number
}
```

---

### `cpl.summary` — 获取最新导入记录

| 属性 | 值 |
|------|----|
| 认证 | Public |
| 类型 | Query |

**输入：** 无

**输出：** 最新 Summary 对象或 null

---

### `cpl.import` — 导入 Excel 产品数据

| 属性 | 值 |
|------|----|
| 认证 | Protected |
| 类型 | Mutation |

**输入：**
```typescript
{
  fileBase64: string   // Base64 编码的 Excel 文件
  fileName: string     // 文件名（用于版本追踪）
}
```

**输出：**
```typescript
{
  success: boolean
  sheetsImported: number
  productsImported: number
  hasSummary: boolean
}
```

**处理流程：** 解析 Excel → 映射中英文列名 → 验证数据 → 批量插入（每批 200 条）

---

## 数据模型

### User 用户
```typescript
{
  id: number
  openId: string           // 唯一标识
  username?: string
  passwordHash?: string    // API 响应中不返回
  name?: string
  email?: string
  loginMethod?: string     // "local" | "email" | "google" 等
  role: "user" | "admin"
  createdAt: Date
  updatedAt: Date
  lastSignedIn: Date
}
```

### Quotation 报价单
```typescript
{
  id: number
  quotationNo: string      // 自动生成：QT-YYYYMMDD-NNN
  customerName: string
  customerContact?: string
  customerPhone?: string
  customerEmail?: string
  projectName?: string
  status: "draft" | "submitted" | "approved" | "sent" | "completed" | "cancelled"
  discountRate: number
  totalAmount: number
  notes?: string
  createdBy: number
  validUntil?: Date
  createdAt: Date
  updatedAt: Date
}
```

### QuotationItem 报价单项
```typescript
{
  id: number
  quotationId: number
  productId?: number
  productModel: string
  productDesc?: string
  listPrice?: string
  quantity: number
  unitPrice?: number
  discountRate: number
  subtotal: number
}
```

### CplProduct 产品
```typescript
{
  id: number
  sheetName: string
  productGroup?: string     // 产品组件
  taxCategory?: string      // 税务小类
  productModel?: string     // 产品型号
  productDesc?: string      // 产品说明
  salesCategory?: string    // 销售类别
  serviceCategory?: string  // 服务类别
  productStatus?: string    // 产品状态
  listPrice?: string        // 媒体价
  priceNote?: string        // 价格说明
  isNew?: string            // 新品
  remark?: string           // 备注
}
```

---

## Excel 导入列名映射

| 中文列名 | 英文字段 |
|---------|---------|
| 产品组件 | productGroup |
| 税务小类 | taxCategory |
| 产品型号 | productModel |
| 产品说明 | productDesc |
| 销售类别 | salesCategory |
| 服务类别 | serviceCategory |
| 产品状态 | productStatus |
| 媒体价 | listPrice |
| 价格说明 | priceNote |
| 新品 | isNew |
| 备注 | remark |
