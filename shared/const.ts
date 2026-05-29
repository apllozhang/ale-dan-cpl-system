export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// Role definitions
export const ROLES = ["user", "admin", "sales_manager", "sales_rep", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  user: "普通用户",
  admin: "管理员",
  sales_manager: "销售经理",
  sales_rep: "销售代表",
  viewer: "查看者",
};

// Permission constants
export const PERMISSIONS = {
  VIEW_PRODUCTS: "view_products",
  CREATE_QUOTATION: "create_quotation",
  EDIT_OWN_QUOTATION: "edit_own_quotation",
  EDIT_ALL_QUOTATIONS: "edit_all_quotations",
  APPROVE_QUOTATION: "approve_quotation",
  DELETE_QUOTATION: "delete_quotation",
  IMPORT_DATA: "import_data",
  MANAGE_USERS: "manage_users",
  VIEW_ACTIVITY_LOGS: "view_activity_logs",
  MANAGE_SPECS: "manage_specs",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Role-Permission matrix: which roles have which permissions
const SUPER_ADMIN_ROLE = "_superAdmin";
type RoleOrSuper = Role | typeof SUPER_ADMIN_ROLE;

export const ROLE_PERMISSIONS: Record<Permission, RoleOrSuper[]> = {
  [PERMISSIONS.VIEW_PRODUCTS]: [SUPER_ADMIN_ROLE, "admin", "sales_manager", "sales_rep", "viewer", "user"],
  [PERMISSIONS.CREATE_QUOTATION]: [SUPER_ADMIN_ROLE, "admin", "sales_manager", "sales_rep"],
  [PERMISSIONS.EDIT_OWN_QUOTATION]: [SUPER_ADMIN_ROLE, "admin", "sales_manager", "sales_rep"],
  [PERMISSIONS.EDIT_ALL_QUOTATIONS]: [SUPER_ADMIN_ROLE, "admin", "sales_manager"],
  [PERMISSIONS.APPROVE_QUOTATION]: [SUPER_ADMIN_ROLE, "admin", "sales_manager"],
  [PERMISSIONS.DELETE_QUOTATION]: [SUPER_ADMIN_ROLE, "admin"],
  [PERMISSIONS.IMPORT_DATA]: [SUPER_ADMIN_ROLE],
  [PERMISSIONS.MANAGE_USERS]: [SUPER_ADMIN_ROLE, "admin"],
  [PERMISSIONS.VIEW_ACTIVITY_LOGS]: [SUPER_ADMIN_ROLE, "admin"],
  [PERMISSIONS.MANAGE_SPECS]: [SUPER_ADMIN_ROLE, "admin"],
};

export function hasPermission(user: { role: string; isSuperAdmin: boolean }, permission: Permission): boolean {
  if (user.isSuperAdmin) return true;
  const allowed = ROLE_PERMISSIONS[permission];
  return allowed.includes(user.role as Role);
}

export const QUOTATION_STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  submitted: "已提交",
  approved: "已审批",
  sent: "已发送",
  completed: "已完成",
  cancelled: "已取消",
};

export const QUOTATION_STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  submitted: "bg-info-soft text-info border-info-border",
  approved: "bg-success-soft text-success border-success-border",
  sent: "bg-accent text-accent-foreground border-border",
  completed: "bg-success-soft text-success border-success-border",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

export const QUOTATION_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["approved", "cancelled"],
  approved: ["sent", "cancelled"],
  sent: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
