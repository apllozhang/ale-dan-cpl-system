# ALE DAN CPL 系统 - Project TODO

- [x] Custom login page with fixed credentials (aletss / Ale@tss) and session management
- [x] Dashboard layout with sidebar navigation, system title "ALE DAN CPL 系统", and logout button
- [x] Database schema for CPL products, sheets, and summary data
- [x] Multi-sheet data viewer with tab/sidebar navigation to switch between product sheets
- [x] Data table with exact columns: 产品组件, 税务小类, 产品型号, 产品说明, 销售类别, 服务类别, 产品状态, 媒体价, 价格说明, 新品, 备注
- [x] Pagination support for data tables
- [x] Sortable columns in data tables
- [x] Multi-field filtering across all columns
- [x] Keyword search with dynamic results updating
- [x] Excel file import (.xlsx) to replace/update CPL data in database
- [x] Summary sheet / Changelog panel displaying actual Excel "Summary" sheet content
- [x] Initial data seeding from uploaded Excel file
- [x] Elegant, polished, professional visual design throughout
- [x] Vitest tests for backend procedures


### 表格增强功能

- [x] 每一列添加明显的竖向分隔线
- [x] 自动调整列宽和行高，根据内容自动换行
- [x] 表格底部添加横向滚动条
- [x] 添加列显隐控制，用户可选择显示/隐藏特定列

## 列宽和默认显示优化

- [x] 实现可拖动列宽调整功能
- [x] 设置默认列显示：仅显示“产品型号”、“产品说明”、“媒体价”
- [x] 其他列默认隐藏，用户可手动选择显示
- [x] 保存用户的列宽和显示偏好到本地存储


## Bug Fixes & Improvements (用户反馈)

- [x] 修复列宽调整：确保每列宽度可以独立调整，不影响其他列
- [x] 修复仕表板导航：点击产品系列时跳转到对应的 Sheet，而不是固定跳转到 OmniSwitch 9900
- [x] 添加行高亮：选中的表格行需要高亮显示
- [x] 实现全表搜索：搜索功能应该在所有产品数据中搜索，而不仅限于当前 Sheet


## 批量选择功能

- [x] 在表格每一行前面添加复选框
- [x] 实现全选/取消全选功能
- [x] 显示已选择产品数量
- [x] 为批量导出/更新预留接口


## 列宽独立性修复

- [x] 修复列宽调整：确保每列宽度完全独立，修改一列不影响其他列
- [x] 实现固定表宽容器，支持水平滚动
- [x] 验证列宽调整的独立性


## 产品系列导航修复

- [x] 修复仕表板产品系列导航：点击不同型号应跳转到对应的 Sheet
- [x] 验证所有产品系列导航正确


## 批量导出功能

- [x] 安装 Excel 导出库（xlsx 或 exceljs）
- [x] 创建导出工具函数
- [x] 在 DataViewer 中实现导出逻辑
- [x] 添加导出按钮到批量操作工具栏
- [x] 验证导出的 Excel 文件格式和内容


## Bug: 产品系列导航错误

- [x] 修复仕表板“产品系列概览”导航：点击不同产品系列应跳转到对应 Sheet，而不是都跳转到 OmniSwitch 9900
- [x] 验证所有产品系列导航正确


## 报价系统 Bug 修复

- [x] 修复 quotations 表查询错误：quotation_no LIKE 参数问题
- [x] 修复“添加产品”功能：支持所有产品系列选择，而不仅限于 OmniSwitch 9900


## 报价单产品选择流程重设计

- [x] 设计产品分类体系：有线网络系统、无线网络系统、网管系统、网络安全系统、无源光网络系统、其他
- [x] 实现产品分类导航系统
- [x] 重设计产品选择弹窗：按分类展示，支持数量配置
- [x] 添加网络架构分层逻辑（核心层、汇聚层、接入层）
- [x] 验证新的产品选择流程

## 部署到生产环境

- [x] 部署到生产域名 www.extremecloudiq.cn
- [x] 验证生产环境功能正常


## 产品数据页面重新组织（8大类别收拢）

- [x] 创建产品分类数据结构（8大类别）
- [x] 重构产品数据页面：左侧分类导航，右侧产品列表
- [x] 实现分类切换逻辑（选中分类才显示对应产品）
- [x] 更新 ProductSelectorDialog 使用新的分类结构
- [x] 测试产品数据页面功能
- [x] 测试报价管理中的产品选择流程
- [x] 部署到生产环境


## 产品数据页面侧边栏收缩功能

- [x] 为产品数据页面添加可收缩的侧边栏
- [x] 添加收缩/展开按钮
- [x] 实现平滑的动画过渡
- [x] 保存收缩状态到本地存储
- [x] 测试侧边栏收缩功能
- [x] 部署到生产环境


## ProductSelectorDialog 分类导航优化

- [x] 修改分类选择逻辑：主分类点击后显示"请选择子分类"提示
- [x] 只有子分类点击后才显示产品数据
- [x] Sheet tabs 仅在选中子分类且有多个 sheet 时显示
- [x] 测试所有分类的导航流程
- [x] 部署到生产环境


## ProductSelectorDialog 使用 Sheet tabs 重新设计

- [x] 移除左侧分类导航
- [x] 在顶部添加 Sheet tabs 显示所有产品类型
- [x] 实现 Sheet tabs 的产品类型切换
- [x] 测试不同产品类型的切换
- [ ] 部署到生产环境
