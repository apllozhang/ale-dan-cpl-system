import { trpc } from "@/lib/trpc";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/EmptyState";
import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, Users, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";

export default function Customers() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page] = useState(1);
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
    pageSize: 20,
  });

  const items = customersQuery.data?.items ?? [];
  const total = customersQuery.data?.total ?? 0;

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
            className="pl-9 w-64 h-9 text-sm bg-background"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs font-semibold w-12 text-center">#</TableHead>
              <TableHead className="text-xs font-semibold">客户名称</TableHead>
              <TableHead className="text-xs font-semibold">行业</TableHead>
              <TableHead className="text-xs font-semibold text-center">报价数</TableHead>
              <TableHead className="text-xs font-semibold text-right">总金额</TableHead>
              <TableHead className="text-xs font-semibold text-right">成交额</TableHead>
              <TableHead className="text-xs font-semibold text-right">最近报价</TableHead>
              <TableHead className="text-xs font-semibold w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customersQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  加载中...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState icon={Users} title="暂无客户数据" description="创建报价单后，客户信息会自动汇总到此处" />
                </TableCell>
              </TableRow>
            ) : (
              items.map((customer: any, idx: number) => (
                <CustomerRow
                  key={customer.customerName}
                  customer={customer}
                  rank={(page - 1) * 20 + idx + 1}
                  expanded={expandedCustomer === customer.customerName}
                  onToggle={() => setExpandedCustomer(
                    expandedCustomer === customer.customerName ? null : customer.customerName
                  )}
                  onViewQuotation={(id: number) => setLocation(`/quotations/${id}`)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CustomerRow({
  customer, rank, expanded, onToggle, onViewQuotation,
}: {
  customer: any;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
  onViewQuotation: (id: number) => void;
}) {
  const quotationsQuery = trpc.quotations.list.useQuery(
    { search: customer.customerName, page: 1, pageSize: 10 },
    { enabled: expanded },
  );

  const quotations = quotationsQuery.data?.items ?? [];

  return (
    <>
      <TableRow className="hover:bg-accent/30 cursor-pointer" onClick={onToggle}>
        <TableCell className="text-center text-xs text-muted-foreground">
          {rank <= 3 ? (
            <Badge className={`text-[10px] h-5 w-5 p-0 justify-center ${rank === 1 ? "bg-amber-500/10 text-amber-600 border-amber-200" : rank === 2 ? "bg-slate-400/10 text-slate-500 border-slate-200" : "bg-orange-400/10 text-orange-600 border-orange-200"}`}>
              {rank}
            </Badge>
          ) : (
            <span className="tabular-nums">{rank}</span>
          )}
        </TableCell>
        <TableCell className="text-sm font-medium">{customer.customerName}</TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {customer.industries?.split(",").filter(Boolean).map((ind: string) => (
            <Badge key={ind} variant="secondary" className="text-[10px] h-4 mr-1">{ind}</Badge>
          )) || "—"}
        </TableCell>
        <TableCell className="text-center text-sm tabular-nums">{customer.quotationCount}</TableCell>
        <TableCell className="text-right text-sm font-medium tabular-nums">
          ¥{customer.totalRevenue.toLocaleString()}
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums text-emerald-600">
          ¥{customer.completedRevenue.toLocaleString()}
        </TableCell>
        <TableCell className="text-right text-xs text-muted-foreground">
          {customer.lastQuotationAt
            ? new Date(customer.lastQuotationAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
            : "—"}
        </TableCell>
        <TableCell>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-muted/10">
          <TableCell colSpan={8} className="px-8 py-3">
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
                      <Badge variant="outline" className={`text-[10px] h-4 ${q.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}`}>
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
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
