import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useMemo } from "react";
import {
  Activity, Users, FileText, Search, Loader2, Trash2, Download,
} from "lucide-react";
import { toast } from "sonner";

const RESOURCE_LABELS: Record<string, string> = {
  quotation: "报价单",
  user: "用户",
  import: "数据导入",
  product: "产品",
  auth: "认证",
};

function formatDetail(action: string, detail: string | null): string {
  if (!detail) return "-";
  try {
    const d = JSON.parse(detail);
    switch (action) {
      case "login":
        return d.method === "local" ? "账号密码登录" : d.method === "oauth" ? "OAuth 登录" : "登录系统";
      case "logout":
        return "退出系统";
      case "create_quotation":
        return `创建报价单「${d.quotationNo || ""}」，客户：${d.customerName || ""}，${d.itemCount ?? 0} 个产品`;
      case "update_quotation":
        return `更新报价单「${d.quotationNo || ""}」`;
      case "delete_quotation":
        return `删除报价单「${d.quotationNo || ""}」，客户：${d.customerName || ""}`;
      case "update_status":
        return `报价单「${d.quotationNo || ""}」状态变更为「${d.newStatus || ""}」`;
      case "import_data":
        return `导入文件「${d.fileName || ""}」，${d.sheetsCount ?? 0} 个 Sheet，${d.productsCount ?? 0} 个产品`;
      case "create_user":
        return `创建用户「${d.username || ""}」，角色：${d.role || ""}`;
      case "update_user":
        return `更新用户「${d.username || ""}」${d.changes ? "，变更：" + d.changes : ""}`;
      case "delete_user":
        return `删除用户「${d.username || ""}」`;
      default:
        return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join("，");
    }
  } catch {
    return detail.slice(0, 120);
  }
}

const ACTION_LABELS: Record<string, string> = {
  login: "登录",
  logout: "登出",
  create_quotation: "创建报价",
  update_quotation: "更新报价",
  delete_quotation: "删除报价",
  update_status: "更新状态",
  import_data: "导入数据",
  create_user: "创建用户",
  update_user: "更新用户",
  delete_user: "删除用户",
};

const ACTION_COLORS: Record<string, string> = {
  login: "bg-green-50 text-green-700",
  logout: "bg-gray-50 text-gray-600",
  create_quotation: "bg-blue-50 text-blue-700",
  update_quotation: "bg-amber-50 text-amber-700",
  delete_quotation: "bg-red-50 text-red-700",
  update_status: "bg-purple-50 text-purple-700",
  import_data: "bg-indigo-50 text-indigo-700",
  create_user: "bg-teal-50 text-teal-700",
  update_user: "bg-orange-50 text-orange-700",
  delete_user: "bg-red-50 text-red-600",
};

export default function ActivityLog() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [clearOpen, setClearOpen] = useState(false);
  const pageSize = 20;

  const { data: stats } = trpc.activityLogs.stats.useQuery();
  const { data, isLoading, refetch } = trpc.activityLogs.list.useQuery({
    search: search || undefined,
    action: actionFilter !== "all" ? actionFilter : undefined,
    page,
    pageSize,
  });

  const clearMutation = trpc.activityLogs.clear.useMutation({
    onSuccess: () => { toast.success("日志已清除"); refetch(); },
    onError: (err: any) => toast.error(err.message || "清除失败"),
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-5 h-5" />
          操作日志
        </h1>
        <Button variant="outline" size="sm" onClick={() => setClearOpen(true)} disabled={clearMutation.isPending} className="text-destructive hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5 mr-1" />
          清除日志
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50 text-green-600">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">{stats?.today ?? 0}</div>
                <p className="text-xs text-muted-foreground">今日操作</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">{stats?.week ?? 0}</div>
                <p className="text-xs text-muted-foreground">近7天操作</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">{stats?.byAction?.login ?? 0}</div>
                <p className="text-xs text-muted-foreground">近7天登录</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="搜索用户、操作、详情..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue placeholder="操作类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部操作</SelectItem>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Log table */}
      <Card className="flex-1 overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr className="bg-muted/30 border-b">
                <th className="text-xs font-semibold px-4 py-2.5 text-left w-[160px]">时间</th>
                <th className="text-xs font-semibold px-4 py-2.5 text-left w-[100px]">用户</th>
                <th className="text-xs font-semibold px-4 py-2.5 text-left w-[120px]">操作</th>
                <th className="text-xs font-semibold px-4 py-2.5 text-left w-[100px]">资源类型</th>
                <th className="text-xs font-semibold px-4 py-2.5 text-left">详情</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="h-32 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : !data?.items?.length ? (
                <tr><td colSpan={5} className="h-32 text-center text-muted-foreground text-sm">暂无操作日志</td></tr>
              ) : data.items.map((log: any) => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-accent/20">
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString("zh-CN")}
                  </td>
                  <td className="px-4 py-2 text-xs font-medium">{log.username || "-"}</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${ACTION_COLORS[log.action] || ""}`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{RESOURCE_LABELS[log.resourceType] || log.resourceType || "-"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground" style={{ maxWidth: 400 }}>
                    {formatDetail(log.action, log.detail)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>共 {data?.total ?? 0} 条记录</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-7 text-xs">上一页</Button>
            <span>{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-7 text-xs">下一页</Button>
          </div>
        </div>
      )}

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清除日志</AlertDialogTitle>
            <AlertDialogDescription>清除后将删除所有操作日志，此操作不可恢复。确定要继续吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => { clearMutation.mutate(); setClearOpen(false); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">确认清除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
