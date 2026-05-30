import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ROLE_LABELS, hasPermission, PERMISSIONS } from "@shared/const";
import type { Role } from "@shared/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useState, useMemo } from "react";
import { Users, Plus, Pencil, Trash2, Loader2, Shield, Building2, Group } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useTableFeatures, type ColumnDef } from "@/hooks/useTableFeatures";
import TablePagination from "@/components/TablePagination";

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
  user: "bg-muted text-muted-foreground border-border",
  admin: "bg-info-soft text-info border-info-border",
  sales_manager: "bg-warning-soft text-warning border-warning-border",
  sales_rep: "bg-success-soft text-success border-success-border",
  viewer: "bg-accent text-accent-foreground border-border",
};

function roleBadgeStyle(role: string): string {
  return ROLE_BADGE_STYLES[role as Role] ?? "bg-muted text-muted-foreground border-border";
}

export default function UserManagement() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.isSuperAdmin === true;
  const canManageUsers = user ? hasPermission(user, PERMISSIONS.MANAGE_USERS) : false;

  // Access control
  if (!canManageUsers) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Shield className="w-12 h-12 text-muted-foreground/30" />
        <p className="text-sm font-medium text-foreground">{t('common.noPermission')}</p>
        <p className="text-xs text-muted-foreground">{t('user.noPermission')}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Users className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">{t('user.title')}</h1>
      </div>

      <Tabs defaultValue="users" className="flex-1 flex flex-col">
        <TabsList className="w-fit">
          {isSuperAdmin && (
            <>
              <TabsTrigger value="organizations" className="gap-1.5 text-xs">
                <Building2 className="w-3.5 h-3.5" />
                {t('user.orgTab')}
              </TabsTrigger>
              <TabsTrigger value="groups" className="gap-1.5 text-xs">
                <Group className="w-3.5 h-3.5" />
                {t('user.groupTab')}
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="users" className="gap-1.5 text-xs">
            <Users className="w-3.5 h-3.5" />
            {t('user.userTab')}
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
  const { t } = useTranslation();
  const orgsQuery = trpc.organizations.list.useQuery();
  const createMut = trpc.organizations.create.useMutation();
  const updateMut = trpc.organizations.update.useMutation();
  const deleteMut = trpc.organizations.delete.useMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const orgs = orgsQuery.data ?? [];

  const orgColumns: ColumnDef[] = useMemo(() => [
    { key: "id", label: t('common.id'), defaultWidth: 60, sortable: true },
    { key: "name", label: t('common.name'), defaultWidth: 200, sortable: true },
    { key: "createdAt", label: t('common.created'), defaultWidth: 180, sortable: true },
    { key: "actions", label: t('common.actions'), defaultWidth: 96 },
  ], [t]);

  const { renderHeader, renderCell, sortData } = useTableFeatures(orgColumns);

  const sortedOrgs = sortData(orgs);

  const openCreate = () => { setEditingId(null); setName(""); setDialogOpen(true); };
  const openEdit = (o: any) => { setEditingId(o.id); setName(o.name); setDialogOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) { toast.error(t('user.validationOrgName')); return; }
    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, name: name.trim() });
        toast.success(t('user.orgUpdated'));
      } else {
        await createMut.mutateAsync({ name: name.trim() });
        toast.success(t('user.orgCreated'));
      }
      setDialogOpen(false);
      orgsQuery.refetch();
    } catch (err: any) { toast.error(err.message || t('common.operationFailed')); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMut.mutateAsync({ id: deleteId });
      toast.success(t('user.orgDeleted'));
      setDeleteId(null);
      orgsQuery.refetch();
    } catch (err: any) { toast.error(err.message || t('user.deleteFailed')); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="font-normal text-xs">{t('user.orgCount', { count: orgs.length })}</Badge>
        <Button size="sm" onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4" />{t('user.createOrg')}</Button>
      </div>
      <div className="flex-1 border rounded-lg bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table style={{ width: 'max-content', minWidth: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-muted/30 hover:bg-muted/30 border-b">
                {orgColumns.map((col, i) => renderHeader(col, i === orgColumns.length - 1))}
              </tr>
            </thead>
            <tbody>
              {orgsQuery.isLoading ? (
                <tr><td colSpan={4} className="h-32 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : sortedOrgs.length === 0 ? (
                <tr><td colSpan={4} className="h-32 text-center text-muted-foreground text-sm">{t('user.noOrgs')}</td></tr>
              ) : sortedOrgs.map((o: any) => (
                <tr key={o.id} className="hover:bg-accent/30 border-b border-border/30">
                  {renderCell(orgColumns[0], false, <span className="text-sm">{o.id}</span>)}
                  {renderCell(orgColumns[1], false, <span className="text-sm font-medium">{o.name}</span>)}
                  {renderCell(orgColumns[2], false, <span className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString("zh-CN")}</span>)}
                  {renderCell(orgColumns[3], true, (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(o)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setDeleteId(o.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingId ? t('user.editOrg') : t('user.createOrg')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>{t('common.name')} *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder={t('user.orgNamePlaceholder')} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingId ? t('common.save') : t('user.createOrg')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle><AlertDialogDescription>{t('user.deleteOrgWarning')}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">{t('common.delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==================== User Group Management ====================
function GroupManagement() {
  const { t } = useTranslation();
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

  const groupColumns: ColumnDef[] = useMemo(() => [
    { key: "id", label: t('common.id'), defaultWidth: 60, sortable: true },
    { key: "name", label: t('common.name'), defaultWidth: 180, sortable: true },
    { key: "organizationId", label: t('user.groupOrg'), defaultWidth: 180, sortable: true },
    { key: "createdAt", label: t('common.created'), defaultWidth: 180, sortable: true },
    { key: "actions", label: t('common.actions'), defaultWidth: 96 },
  ], [t]);

  const { renderHeader, renderCell, sortData } = useTableFeatures(groupColumns);

  const getOrgName = (id: number) => orgs.find((o: any) => o.id === id)?.name || "-";

  const sortedGroups = sortData(groups);

  const openCreate = () => { setEditingId(null); setName(""); setOrgId(orgs[0]?.id || 0); setDialogOpen(true); };
  const openEdit = (g: any) => { setEditingId(g.id); setName(g.name); setOrgId(g.organizationId); setDialogOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) { toast.error(t('user.validationGroupName')); return; }
    if (!orgId) { toast.error(t('user.validationGroupOrg')); return; }
    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, name: name.trim(), organizationId: orgId });
        toast.success(t('user.groupUpdated'));
      } else {
        await createMut.mutateAsync({ name: name.trim(), organizationId: orgId });
        toast.success(t('user.groupCreated'));
      }
      setDialogOpen(false);
      groupsQuery.refetch();
    } catch (err: any) { toast.error(err.message || t('common.operationFailed')); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMut.mutateAsync({ id: deleteId });
      toast.success(t('user.groupDeleted'));
      setDeleteId(null);
      groupsQuery.refetch();
    } catch (err: any) { toast.error(err.message || t('user.deleteFailed')); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="font-normal text-xs">{t('user.groupCount', { count: groups.length })}</Badge>
        <Button size="sm" onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4" />{t('user.createGroup')}</Button>
      </div>
      <div className="flex-1 border rounded-lg bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table style={{ width: 'max-content', minWidth: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-muted/30 hover:bg-muted/30 border-b">
                {groupColumns.map((col, i) => renderHeader(col, i === groupColumns.length - 1))}
              </tr>
            </thead>
            <tbody>
              {groupsQuery.isLoading ? (
                <tr><td colSpan={5} className="h-32 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : sortedGroups.length === 0 ? (
                <tr><td colSpan={5} className="h-32 text-center text-muted-foreground text-sm">{t('user.noGroups')}</td></tr>
              ) : sortedGroups.map((g: any) => (
                <tr key={g.id} className="hover:bg-accent/30 border-b border-border/30">
                  {renderCell(groupColumns[0], false, <span className="text-sm">{g.id}</span>)}
                  {renderCell(groupColumns[1], false, <span className="text-sm font-medium">{g.name}</span>)}
                  {renderCell(groupColumns[2], false, <span className="text-sm">{getOrgName(g.organizationId)}</span>)}
                  {renderCell(groupColumns[3], false, <span className="text-xs text-muted-foreground">{new Date(g.createdAt).toLocaleString("zh-CN")}</span>)}
                  {renderCell(groupColumns[4], true, (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(g)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setDeleteId(g.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingId ? t('user.editGroup') : t('user.createGroup')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>{t('common.name')} *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder={t('user.groupNamePlaceholder')} /></div>
            <div className="space-y-2"><Label>{t('user.groupOrg')} *</Label>
              <Select value={String(orgId)} onValueChange={v => setOrgId(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{orgs.map((o: any) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingId ? t('common.save') : t('user.createGroup')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle><AlertDialogDescription>{t('user.deleteGroupWarning')}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">{t('common.delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==================== User Management Tab ====================
function UserManagementTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { t } = useTranslation();
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const users = usersQuery.data ?? [];
  const orgs = orgsQuery.data ?? [];
  const groups = groupsQuery.data ?? [];

  const userColumns: ColumnDef[] = useMemo(() => {
    const cols: ColumnDef[] = [
      { key: "username", label: t('common.username'), defaultWidth: 160, sortable: true },
      { key: "name", label: t('common.name'), defaultWidth: 120, sortable: true },
      { key: "email", label: t('common.email'), defaultWidth: 180, sortable: true },
    ];
    if (isSuperAdmin) {
      cols.push({ key: "organizationId", label: t('common.organization'), defaultWidth: 140, sortable: true });
      cols.push({ key: "groupId", label: t('common.group'), defaultWidth: 140, sortable: true });
    }
    cols.push({ key: "role", label: t('common.role'), defaultWidth: 100, sortable: true });
    cols.push({ key: "lastSignedIn", label: t('user.lastLogin'), defaultWidth: 160, sortable: true });
    cols.push({ key: "actions", label: t('common.actions'), defaultWidth: 96 });
    return cols;
  }, [t, isSuperAdmin]);

  const { renderHeader, renderCell, sortData } = useTableFeatures(userColumns);

  const getOrgName = (id: number | null | undefined) => { if (!id) return "-"; return orgs.find((o: any) => o.id === id)?.name || "-"; };
  const getGroupName = (id: number | null | undefined) => { if (!id) return "-"; return groups.find((g: any) => g.id === id)?.name || "-"; };

  const sortedUsers = sortData(users);
  const totalPages = Math.ceil(sortedUsers.length / pageSize);
  const pagedUsers = sortedUsers.slice((page - 1) * pageSize, page * pageSize);

  // Reset page when page size changes
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const colCount = userColumns.length;

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
    if (!form.username || form.username.length < 3) { toast.error(t('user.usernameMin')); return; }
    if (!editingId && (!form.password || form.password.length < 6)) { toast.error(t('user.passwordMin')); return; }
    if (editingId && form.password && form.password.length < 6) { toast.error(t('user.passwordMin')); return; }
    if (form.password && form.password !== form.password2) { toast.error(t('user.passwordMismatch')); return; }
    if (!editingId && !form.password2) { toast.error(t('user.validationPasswordConfirm')); return; }
    try {
      if (editingId) {
        const { password2, ...raw }: any = { id: editingId, ...form };
        if (!raw.password) delete raw.password;
        // Convert empty strings to undefined for optional fields
        if (!raw.name) raw.name = undefined;
        if (!raw.email) raw.email = undefined;
        await updateMutation.mutateAsync(raw);
        toast.success(t('user.userUpdated'));
      } else {
        const { password2, ...data }: any = form;
        if (!data.name) data.name = undefined;
        if (!data.email) data.email = undefined;
        await createMutation.mutateAsync(data);
        toast.success(t('user.userCreated'));
      }
      setDialogOpen(false);
      usersQuery.refetch();
    } catch (err: any) { toast.error(err.message || t('common.operationFailed')); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteId });
      toast.success(t('user.userDeleted'));
      setDeleteId(null);
      usersQuery.refetch();
    } catch (err: any) { toast.error(err.message || t('user.deleteFailed')); }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="font-normal text-xs">{t('user.userCount', { count: users.length })}</Badge>
        <Button size="sm" onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4" />{t('user.createUser')}</Button>
      </div>
      <div className="flex-1 border rounded-lg bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table style={{ width: 'max-content', minWidth: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-muted/30 hover:bg-muted/30 border-b">
                {userColumns.map((col, i) => renderHeader(col, i === userColumns.length - 1))}
              </tr>
            </thead>
            <tbody>
              {usersQuery.isLoading ? (
                <tr><td colSpan={colCount} className="h-32 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : pagedUsers.length === 0 ? (
                <tr><td colSpan={colCount} className="h-32 text-center text-muted-foreground text-sm">{t('user.noUsers')}</td></tr>
              ) : pagedUsers.map((u: any) => {
                let cellIdx = 0;
                return (
                  <tr key={u.id} className="hover:bg-accent/30 border-b border-border/30">
                    {renderCell(userColumns[cellIdx++], false, <span className="text-sm font-medium">{u.username}{u.isSuperAdmin ? <Badge className="ml-1.5 text-[10px] h-4 px-1 bg-warning-soft text-warning border-warning-border">{t('user.superAdminBadge')}</Badge> : null}</span>)}
                    {renderCell(userColumns[cellIdx++], false, <span className="text-sm">{u.name || "-"}</span>)}
                    {renderCell(userColumns[cellIdx++], false, <span className="text-sm text-muted-foreground">{u.email || "-"}</span>)}
                    {isSuperAdmin && renderCell(userColumns[cellIdx++], false, <span className="text-xs">{getOrgName(u.organizationId)}</span>)}
                    {isSuperAdmin && renderCell(userColumns[cellIdx++], false, <span className="text-xs">{getGroupName(u.groupId)}</span>)}
                    {renderCell(userColumns[cellIdx++], false, <Badge className={`text-[10px] h-5 px-1.5 ${roleBadgeStyle(u.role)}`}>{ROLE_LABELS[u.role as Role] || u.role}</Badge>)}
                    {renderCell(userColumns[cellIdx++], false, <span className="text-xs text-muted-foreground">{u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleString("zh-CN") : "-"}</span>)}
                    {renderCell(userColumns[cellIdx], true, (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(u)}><Pencil className="w-3.5 h-3.5" /></Button>
                        {!u.isSuperAdmin && <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setDeleteId(u.id)}><Trash2 className="w-3.5 h-3.5" /></Button>}
                      </div>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 0 && (
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={sortedUsers.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle>{editingId ? t('user.editUser') : t('user.createUser')}</DialogTitle></DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1 px-1">
            <div className="space-y-1.5"><Label>{t('common.username')} *</Label><Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder={t('user.usernameMin')} disabled={!!editingId} /></div>
            {!form.isSuperAdmin && (
              <>
                <div className="space-y-1.5"><Label>{editingId ? t('user.newPassword') : t('user.password') + ' *'}</Label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editingId ? t('common.optional') : t('user.passwordMin')} /></div>
                {(form.password || !editingId) && (
                  <div className="space-y-1.5"><Label>{t('user.confirmPassword')} *</Label><Input type="password" value={form.password2} onChange={e => setForm(f => ({ ...f, password2: e.target.value }))} placeholder={t('user.passwordMin')} /></div>
                )}
              </>
            )}
            {form.isSuperAdmin && editingId && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">超管密码不允许修改</div>
            )}
            <div className="space-y-1.5"><Label>{t('common.name')}</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('common.optional')} /></div>
            <div className="space-y-1.5"><Label>{t('common.email')}</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder={t('common.optional')} /></div>
            {isSuperAdmin && (
              <>
                <div className="space-y-1.5"><Label>{t('common.organization')}</Label>
                  <Select value={form.organizationId ? String(form.organizationId) : "none"} onValueChange={v => setForm(f => ({ ...f, organizationId: v === "none" ? undefined : Number(v) }))}>
                    <SelectTrigger><SelectValue placeholder={t('user.selectOrg')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('common.no')}</SelectItem>
                      {orgs.map((o: any) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>{t('common.group')}</Label>
                  <Select value={form.groupId ? String(form.groupId) : "none"} onValueChange={v => setForm(f => ({ ...f, groupId: v === "none" ? undefined : Number(v) }))}>
                    <SelectTrigger><SelectValue placeholder={t('user.selectGroup')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('common.no')}</SelectItem>
                      {groups.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.name} ({getOrgName(g.organizationId)})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="isSuperAdmin" checked={form.isSuperAdmin} onCheckedChange={v => setForm(f => ({ ...f, isSuperAdmin: !!v }))} />
                  <Label htmlFor="isSuperAdmin" className="text-sm cursor-pointer">{t('user.superAdmin')}</Label>
                </div>
              </>
            )}
            <div className="space-y-1.5"><Label>{t('common.role')}</Label>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{editingId ? t('common.save') : t('user.createUser')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle><AlertDialogDescription>{t('user.deleteUserWarning')}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">{t('common.delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
