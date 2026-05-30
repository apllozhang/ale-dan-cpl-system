import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/EmptyState";
import { useState, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { Search, Users, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { useMobilePreview } from "@/contexts/MobilePreviewContext";
import { useTableFeatures, type ColumnDef } from "@/hooks/useTableFeatures";
import TablePagination from "@/components/TablePagination";

export default function Customers() {
  const [, setLocation] = useLocation();
  const isMobilePreview = useMobilePreview();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  const customersQuery = trpc.customers.list.useQuery({
    search: debouncedSearch || undefined,
    page,
    pageSize,
  });

  const items = customersQuery.data?.items ?? [];
  const total = customersQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const customerColumns: ColumnDef[] = useMemo(() => [
    { key: "rank", label: "#", defaultWidth: 48 },
    { key: "customerName", label: "客户名称", defaultWidth: 200, sortable: true },
    { key: "industries", label: "行业", defaultWidth: 140 },
    { key: "quotationCount", label: "报价数", defaultWidth: 80, sortable: true },
    { key: "totalRevenue", label: "总金额", defaultWidth: 120, sortable: true },
    { key: "completedRevenue", label: "成交额", defaultWidth: 120, sortable: true },
    { key: "lastQuotationAt", label: "最近报价", defaultWidth: 100, sortable: true },
    { key: "expand", label: "", defaultWidth: 40 },
  ], []);

  const { renderHeader, renderCell, sortData } = useTableFeatures(customerColumns);

  const sortedItems = sortData(items);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">客户管理</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            从报价单中自动汇总的客户数据，共 {total} 个客户
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索客户名称..."
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className={`pl-9 h-9 text-sm bg-background ${isMobilePreview ? "w-full" : "w-64"}`}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table style={{ width: 'max-content', minWidth: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-muted/30 hover:bg-muted/30 border-b">
                {customerColumns.map((col, i) => renderHeader(col, i === customerColumns.length - 1))}
              </tr>
            </thead>
            <tbody>
              {customersQuery.isLoading ? (
                <tr>
                  <td colSpan={8} className="h-32 text-center text-muted-foreground">
                    加载中...
                  </td>
                </tr>
              ) : sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState icon={Users} title="暂无客户数据" description="创建报价单后，客户信息会自动汇总到此处" />
                  </td>
                </tr>
              ) : (
                sortedItems.map((customer: any, idx: number) => (
                  <CustomerRow
                    key={customer.customerName}
                    customer={customer}
                    rank={(page - 1) * pageSize + idx + 1}
                    expanded={expandedCustomer === customer.customerName}
                    onToggle={() => setExpandedCustomer(
                      expandedCustomer === customer.customerName ? null : customer.customerName
                    )}
                    onViewQuotation={(id: number) => setLocation(`/quotations/${id}`)}
                    columns={customerColumns}
                    renderCell={renderCell}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 0 && (
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>
    </div>
  );
}

function CustomerRow({
  customer, rank, expanded, onToggle, onViewQuotation, columns, renderCell,
}: {
  customer: any;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
  onViewQuotation: (id: number) => void;
  columns: ColumnDef[];
  renderCell: (col: ColumnDef, isLast: boolean, content: React.ReactNode) => React.ReactNode;
}) {
  const quotationsQuery = trpc.quotations.list.useQuery(
    { search: customer.customerName, page: 1, pageSize: 10 },
    { enabled: expanded },
  );

  const quotations = quotationsQuery.data?.items ?? [];

  return (
    <>
      <tr className="hover:bg-accent/30 cursor-pointer" onClick={onToggle}>
        {renderCell(columns[0], false,
          <span className="flex justify-center text-xs text-muted-foreground">
            {rank <= 3 ? (
              <Badge className={`text-[10px] h-5 w-5 p-0 justify-center ${rank === 1 ? "bg-amber-500/10 text-amber-600 border-amber-200" : rank === 2 ? "bg-slate-400/10 text-slate-500 border-slate-200" : "bg-orange-400/10 text-orange-600 border-orange-200"}`}>
                {rank}
              </Badge>
            ) : (
              <span className="tabular-nums">{rank}</span>
            )}
          </span>
        )}
        {renderCell(columns[1], false, <span className="text-sm font-medium">{customer.customerName}</span>)}
        {renderCell(columns[2], false,
          <span className="text-xs text-muted-foreground">
            {customer.industries?.split(",").filter(Boolean).map((ind: string) => (
              <Badge key={ind} variant="secondary" className="text-[10px] h-4 mr-1">{ind}</Badge>
            )) || "—"}
          </span>
        )}
        {renderCell(columns[3], false, <span className="flex justify-center text-sm tabular-nums">{customer.quotationCount}</span>)}
        {renderCell(columns[4], false, <span className="flex justify-end text-sm font-medium tabular-nums">¥{customer.totalRevenue.toLocaleString()}</span>)}
        {renderCell(columns[5], false, <span className="flex justify-end text-sm tabular-nums text-success">¥{customer.completedRevenue.toLocaleString()}</span>)}
        {renderCell(columns[6], false,
          <span className="flex justify-end text-xs text-muted-foreground">
            {customer.lastQuotationAt
              ? new Date(customer.lastQuotationAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
              : "—"}
          </span>
        )}
        {renderCell(columns[7], true,
          expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </tr>
      {expanded && (
        <tr className="bg-muted/10">
          <td colSpan={8} className="px-8 py-3">
            {quotationsQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">加载中...</p>
            ) : quotations.length === 0 ? (
              <p className="text-xs text-muted-foreground">暂无关联报价单</p>
            ) : (
              <div className="space-y-1">
                {quotations.map((q: any) => (
                  <button
                    key={q.id}
                    onClick={() => onViewQuotation(q.id)}
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded hover:bg-accent/20 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground tabular-nums">{q.quotationNo}</span>
                      <span className="text-xs font-medium">{q.projectName || "—"}</span>
                      <Badge variant="outline" className={`text-[10px] h-4 ${q.status === "completed" ? "bg-success-soft text-success border-success-border" : ""}`}>
                        {q.status === "draft" ? "草稿" : q.status === "submitted" ? "已提交" : q.status === "approved" ? "已审批" : q.status === "sent" ? "已发送" : q.status === "completed" ? "已完成" : "已取消"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs tabular-nums">¥{Number(q.totalAmount || 0).toLocaleString()}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
