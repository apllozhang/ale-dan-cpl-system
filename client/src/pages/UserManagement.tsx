import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ROLE_LABELS, hasPermission, PERMISSIONS } from "@shared/const";
import type { Role } from "@shared/const";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { Users, Plus, Pencil, Trash2, Loader2, Shield, Building2, Group } from "lucide-react";
import { toast } from "sonner";

type UserForm = {
  username: string;
  password: string;
  password2: string;
  name: string;
  email: string;
  role: Role;
  isSuperAdmin: boolean;
  organizationId: number | undefined;
  groupId: number | undefined;
};

const emptyUserForm: UserForm = {
  username: "", password: "", password2: "", name: "", email: "", role: "user",
  isSuperAdmin: false, organizationId: undefined, groupId: undefined,
};

const ROLE_BADGE_STYLES: Record<Role, string> = {
  user: "bg-gray-100 text-gray-700 border-gray-200",
  admin: "bg-blue-50 text-blue-700 border-blue-200",
  sales_manager: "bg-amber-50 text-amber-700 border-amber-200",
  sales_rep: "bg-green-50 text-green-700 border-green-200",
  viewer: "bg-purple-50 text-purple-700 border-purple-200",
};

function roleBadgeStyle(role: string): string {
  return ROLE_BADGE_STYLES[role as Role] ?? "bg-gray-100 text-gray-700 border-gray-200";
}

export default function UserManagement() {
  const { user } = useAuth();
  const isSuperAdmin = user?.isSuperAdmin === true;
  const canManageUsers = user ? hasPermission(user, PERMISSIONS.MANAGE_USERS) : false;

  // Access control
  if (!canManageUsers) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Shield className="w-12 h-12 text-muted-foreground/30" />
        <p className="text-sm font-medium text-foreground">无权限访问</p>
        <p className="text-xs text-muted-foreground">仅管理员可访问此页面</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Users className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">用户管理</h1>
      </div>

      <Tabs defaultValue="users" className="flex-1 flex flex-col">
        <TabsList className="w-fit">
          {isSuperAdmin && (
            <>
              <TabsTrigger value="organizations" className="gap-1.5 text-xs">
                <Building2 className="w-3.5 h-3.5" />
                组织
              </TabsTrigger>
              <TabsTrigger value="groups" className="gap-1.5 text-xs">
                <Group className="w-3.5 h-3.5" />
                用户组
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="users" className="gap-1.5 text-xs">
            <Users className="w-3.5 h-3.5" />
            用户
          </TabsTrigger>
        </TabsList>

        {isSuperAdmin && (
          <>
            <TabsContent value="organizations" className="flex-1 mt-3">
              <OrgManagement />
            </TabsContent>
            <TabsContent value="groups" className="flex-1 mt-3">
              <GroupManagement />
            </TabsContent>
          </>
        )}
        <TabsContent value="users" className="flex-1 mt-3">
          <UserManagementTab isSuperAdmin={isSuperAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ==================== Organization Management ====================
function OrgManagement() {
  const orgsQuery = trpc.organizations.list.useQuery();
  const createMut = trpc.organizations.create.useMutation();
  const updateMut = trpc.organizations.update.useMutation();
  const deleteMut = trpc.organizations.delete.useMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const orgs = orgsQuery.data ?? [];

  const openCreate = () => { setEditingId(null); setName(""); setDialogOpen(true); };
  const openEdit = (o: any) => { setEditingId(o.id); setName(o.name); setDialogOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("请输入组织名称"); return; }
    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, name: name.trim() });
        toast.success("组织已更新");
      } else {
        await createMut.mutateAsync({ name: name.trim() });
        toast.success("组织已创建");
      }
      setDialogOpen(false);
      orgsQuery.refetch();
    } catch (err: any) { toast.error(err.message || "操作失败"); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMut.mutateAsync({ id: deleteId });
      toast.success("组织已删除");
      setDeleteId(null);
      orgsQuery.refetch();
    } catch (err: any) { toast.error(err.message || "删除失败"); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="font-normal text-xs">{orgs.length} 个组织</Badge>
        <Button size="sm" onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4" />创建组织</Button>
      </div>
      <div className="flex-1 border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs font-semibold">ID</TableHead>
              <TableHead className="text-xs font-semibold">名称</TableHead>
              <TableHead className="text-xs font-semibold">创建时间</TableHead>
              <TableHead className="text-xs font-semibold w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgsQuery.isLoading ? (
              <TableRow><TableCell colSpan={4} className="h-32 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : orgs.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground text-sm">暂无组织</TableCell></TableRow>
            ) : orgs.map((o: any) => (
              <TableRow key={o.id} className="hover:bg-accent/30">
                <TableCell className="text-sm">{o.id}</TableCell>
                <TableCell className="text-sm font-medium">{o.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString("zh-CN")}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(o)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setDeleteId(o.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingId ? "编辑组织" : "创建组织"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>名称 *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="组织名称" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingId ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>确认删除</AlertDialogTitle><AlertDialogDescription>删除组织将同时影响关联的用户组和用户。确定要删除吗？</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">删除</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==================== User Group Management ====================
function GroupManagement() {
  const groupsQuery = trpc.userGroups.list.useQuery();
  const orgsQuery = trpc.organizations.list.useQuery();
  const createMut = trpc.userGroups.create.useMutation();
  const updateMut = trpc.userGroups.update.useMutation();
  const deleteMut = trpc.userGroups.delete.useMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [orgId, setOrgId] = useState<number>(0);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const groups = groupsQuery.data ?? [];
  const orgs = orgsQuery.data ?? [];

  const getOrgName = (id: number) => orgs.find((o: any) => o.id === id)?.name || "-";

  const openCreate = () => { setEditingId(null); setName(""); setOrgId(orgs[0]?.id || 0); setDialogOpen(true); };
  const openEdit = (g: any) => { setEditingId(g.id); setName(g.name); setOrgId(g.organizationId); setDialogOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("请输入用户组名称"); return; }
    if (!orgId) { toast.error("请选择组织"); return; }
    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, name: name.trim(), organizationId: orgId });
        toast.success("用户组已更新");
      } else {
        await createMut.mutateAsync({ name: name.trim(), organizationId: orgId });
        toast.success("用户组已创建");
      }
      setDialogOpen(false);
      groupsQuery.refetch();
    } catch (err: any) { toast.error(err.message || "操作失败"); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMut.mutateAsync({ id: deleteId });
      toast.success("用户组已删除");
      setDeleteId(null);
      groupsQuery.refetch();
    } catch (err: any) { toast.error(err.message || "删除失败"); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="font-normal text-xs">{groups.length} 个用户组</Badge>
        <Button size="sm" onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4" />创建用户组</Button>
      </div>
      <div className="flex-1 border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs font-semibold">ID</TableHead>
              <TableHead className="text-xs font-semibold">名称</TableHead>
              <TableHead className="text-xs font-semibold">所属组织</TableHead>
              <TableHead className="text-xs font-semibold">创建时间</TableHead>
              <TableHead className="text-xs font-semibold w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupsQuery.isLoading ? (
              <TableRow><TableCell colSpan={5} className="h-32 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : groups.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground text-sm">暂无用户组</TableCell></TableRow>
            ) : groups.map((g: any) => (
              <TableRow key={g.id} className="hover:bg-accent/30">
                <TableCell className="text-sm">{g.id}</TableCell>
                <TableCell className="text-sm font-medium">{g.name}</TableCell>
                <TableCell className="text-sm">{getOrgName(g.organizationId)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(g.createdAt).toLocaleString("zh-CN")}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(g)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setDeleteId(g.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingId ? "编辑用户组" : "创建用户组"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>名称 *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="用户组名称" /></div>
            <div className="space-y-2"><Label>所属组织 *</Label>
              <Select value={String(orgId)} onValueChange={v => setOrgId(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{orgs.map((o: any) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingId ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>确认删除</AlertDialogTitle><AlertDialogDescription>删除后无法恢复，确定要删除此用户组吗？</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">删除</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==================== User Management Tab ====================
function UserManagementTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const usersQuery = trpc.users.list.useQuery();
  const orgsQuery = trpc.organizations.list.useQuery();
  const groupsQuery = trpc.userGroups.list.useQuery();
  const createMutation = trpc.users.create.useMutation();
  const updateMutation = trpc.users.update.useMutation();
  const deleteMutation = trpc.users.delete.useMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<UserForm>(emptyUserForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const users = usersQuery.data ?? [];
  const orgs = orgsQuery.data ?? [];
  const groups = groupsQuery.data ?? [];

  const getOrgName = (id: number | null | undefined) => { if (!id) return "-"; return orgs.find((o: any) => o.id === id)?.name || "-"; };
  const getGroupName = (id: number | null | undefined) => { if (!id) return "-"; return groups.find((g: any) => g.id === id)?.name || "-"; };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyUserForm);
    setDialogOpen(true);
  };

  const openEdit = (u: any) => {
    setEditingId(u.id);
    setForm({
      username: u.username || "",
      password: "",
      password2: "",
      name: u.name || "",
      email: u.email || "",
      role: u.role || "user",
      isSuperAdmin: u.isSuperAdmin ?? false,
      organizationId: u.organizationId ?? undefined,
      groupId: u.groupId ?? undefined,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.username || form.username.length < 3) { toast.error("用户名至少 3 个字符"); return; }
    if (!editingId && (!form.password || form.password.length < 6)) { toast.error("密码至少 6 个字符"); return; }
    if (editingId && form.password && form.password.length < 6) { toast.error("密码至少 6 个字符"); return; }
    if (form.password && form.password !== form.password2) { toast.error("两次密码输入不一致"); return; }
    if (!editingId && !form.password2) { toast.error("请确认密码"); return; }
    try {
      if (editingId) {
        const { password2, ...raw }: any = { id: editingId, ...form };
        if (!raw.password) delete raw.password;
        // Convert empty strings to undefined for optional fields
        if (!raw.name) raw.name = undefined;
        if (!raw.email) raw.email = undefined;
        await updateMutation.mutateAsync(raw);
        toast.success("用户已更新");
      } else {
        const { password2, ...data }: any = form;
        if (!data.name) data.name = undefined;
        if (!data.email) data.email = undefined;
        await createMutation.mutateAsync(data);
        toast.success("用户已创建");
      }
      setDialogOpen(false);
      usersQuery.refetch();
    } catch (err: any) { toast.error(err.message || "操作失败"); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteId });
      toast.success("用户已删除");
      setDeleteId(null);
      usersQuery.refetch();
    } catch (err: any) { toast.error(err.message || "删除失败"); }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="font-normal text-xs">{users.length} 个用户</Badge>
        <Button size="sm" onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4" />创建用户</Button>
      </div>
      <div className="flex-1 border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs font-semibold">用户名</TableHead>
              <TableHead className="text-xs font-semibold">姓名</TableHead>
              <TableHead className="text-xs font-semibold">邮箱</TableHead>
              {isSuperAdmin && <TableHead className="text-xs font-semibold">组织</TableHead>}
              {isSuperAdmin && <TableHead className="text-xs font-semibold">用户组</TableHead>}
              <TableHead className="text-xs font-semibold">角色</TableHead>
              <TableHead className="text-xs font-semibold">最后登录</TableHead>
              <TableHead className="text-xs font-semibold w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQuery.isLoading ? (
              <TableRow><TableCell colSpan={isSuperAdmin ? 8 : 6} className="h-32 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={isSuperAdmin ? 8 : 6} className="h-32 text-center text-muted-foreground text-sm">暂无用户</TableCell></TableRow>
            ) : users.map((u: any) => (
              <TableRow key={u.id} className="hover:bg-accent/30">
                <TableCell className="text-sm font-medium">{u.username}{u.isSuperAdmin ? <Badge className="ml-1.5 text-[10px] h-4 px-1 bg-amber-500/10 text-amber-600 border-amber-200">超管</Badge> : null}</TableCell>
                <TableCell className="text-sm">{u.name || "-"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.email || "-"}</TableCell>
                {isSuperAdmin && <TableCell className="text-xs">{getOrgName(u.organizationId)}</TableCell>}
                {isSuperAdmin && <TableCell className="text-xs">{getGroupName(u.groupId)}</TableCell>}
                <TableCell><Badge className={`text-[10px] h-5 px-1.5 ${roleBadgeStyle(u.role)}`}>{ROLE_LABELS[u.role as Role] || u.role}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleString("zh-CN") : "-"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(u)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setDeleteId(u.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle>{editingId ? "编辑用户" : "创建用户"}</DialogTitle></DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1 px-1">
            <div className="space-y-1.5"><Label>用户名 *</Label><Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="至少 3 个字符" disabled={!!editingId} /></div>
            <div className="space-y-1.5"><Label>{editingId ? "新密码（留空不修改）" : "密码 *"}</Label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editingId ? "留空则不修改" : "至少 6 个字符"} /></div>
            {(form.password || !editingId) && (
              <div className="space-y-1.5"><Label>确认密码 *</Label><Input type="password" value={form.password2} onChange={e => setForm(f => ({ ...f, password2: e.target.value }))} placeholder="再次输入密码" /></div>
            )}
            <div className="space-y-1.5"><Label>姓名</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="可选" /></div>
            <div className="space-y-1.5"><Label>邮箱</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="可选" /></div>
            {isSuperAdmin && (
              <>
                <div className="space-y-1.5"><Label>组织</Label>
                  <Select value={form.organizationId ? String(form.organizationId) : "none"} onValueChange={v => setForm(f => ({ ...f, organizationId: v === "none" ? undefined : Number(v) }))}>
                    <SelectTrigger><SelectValue placeholder="选择组织" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">无</SelectItem>
                      {orgs.map((o: any) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>用户组</Label>
                  <Select value={form.groupId ? String(form.groupId) : "none"} onValueChange={v => setForm(f => ({ ...f, groupId: v === "none" ? undefined : Number(v) }))}>
                    <SelectTrigger><SelectValue placeholder="选择用户组" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">无</SelectItem>
                      {groups.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.name} ({getOrgName(g.organizationId)})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="isSuperAdmin" checked={form.isSuperAdmin} onCheckedChange={v => setForm(f => ({ ...f, isSuperAdmin: !!v }))} />
                  <Label htmlFor="isSuperAdmin" className="text-sm cursor-pointer">超级管理员（拥有全部权限）</Label>
                </div>
              </>
            )}
            <div className="space-y-1.5"><Label>角色</Label>
              <Select value={form.role} onValueChange={(v: string) => setForm(f => ({ ...f, role: v as Role }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-2 pt-2 border-t shrink-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{editingId ? "保存" : "创建"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>确认删除</AlertDialogTitle><AlertDialogDescription>删除后无法恢复，确定要删除此用户吗？</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">删除</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
