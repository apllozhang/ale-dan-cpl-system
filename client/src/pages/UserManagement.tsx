import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Users, Plus, Pencil, Trash2, Loader2, Shield, User } from "lucide-react";
import { toast } from "sonner";

type UserForm = {
  username: string;
  password: string;
  name: string;
  email: string;
  role: "user" | "admin";
};

const emptyForm: UserForm = { username: "", password: "", name: "", email: "", role: "user" };

export default function UserManagement() {
  const { user } = useAuth();
  const usersQuery = trpc.users.list.useQuery();
  const createMutation = trpc.users.create.useMutation();
  const updateMutation = trpc.users.update.useMutation();
  const deleteMutation = trpc.users.delete.useMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const users = usersQuery.data ?? [];

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Shield className="w-12 h-12 text-muted-foreground/30" />
        <p className="text-sm font-medium text-foreground">无权限访问</p>
        <p className="text-xs text-muted-foreground">仅管理员可管理用户</p>
      </div>
    );
  }

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (u: any) => {
    setEditingId(u.id);
    setForm({
      username: u.username || "",
      password: "",
      name: u.name || "",
      email: u.email || "",
      role: u.role || "user",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.username || form.username.length < 3) {
      toast.error("用户名至少 3 个字符");
      return;
    }
    if (!editingId && (!form.password || form.password.length < 6)) {
      toast.error("密码至少 6 个字符");
      return;
    }
    if (editingId && form.password && form.password.length < 6) {
      toast.error("密码至少 6 个字符");
      return;
    }

    try {
      if (editingId) {
        const data: any = { id: editingId, ...form };
        if (!data.password) delete data.password;
        await updateMutation.mutateAsync(data);
        toast.success("用户已更新");
      } else {
        await createMutation.mutateAsync(form);
        toast.success("用户已创建");
      }
      setDialogOpen(false);
      usersQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || "操作失败");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteId });
      toast.success("用户已删除");
      setDeleteId(null);
      usersQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || "删除失败");
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">用户管理</h1>
          <Badge variant="secondary" className="font-normal text-xs">
            {users.length} 个用户
          </Badge>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="w-4 h-4" />
          创建用户
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs font-semibold">用户名</TableHead>
              <TableHead className="text-xs font-semibold">姓名</TableHead>
              <TableHead className="text-xs font-semibold">邮箱</TableHead>
              <TableHead className="text-xs font-semibold">角色</TableHead>
              <TableHead className="text-xs font-semibold">最后登录</TableHead>
              <TableHead className="text-xs font-semibold w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                  暂无用户
                </TableCell>
              </TableRow>
            ) : (
              users.map((u: any) => (
                <TableRow key={u.id} className="hover:bg-accent/30">
                  <TableCell className="text-sm font-medium">{u.username}</TableCell>
                  <TableCell className="text-sm">{u.name || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-[10px] h-5 px-1.5">
                      {u.role === "admin" ? "管理员" : "普通用户"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleString("zh-CN") : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(u)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteId(u.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑用户" : "创建用户"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>用户名 *</Label>
              <Input
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="至少 3 个字符"
                disabled={!!editingId}
              />
            </div>
            <div className="space-y-2">
              <Label>{editingId ? "新密码（留空不修改）" : "密码 *"}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={editingId ? "留空则不修改" : "至少 6 个字符"}
              />
            </div>
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="可选"
              />
            </div>
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="可选"
              />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={form.role} onValueChange={(v: any) => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">普通用户</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingId ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除后无法恢复，确定要删除此用户吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
