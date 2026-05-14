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
