import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { useTheme } from "@/contexts/ThemeContext";
import { hasPermission, PERMISSIONS } from "@shared/const";
import {
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Database,
  FileText,
  HardDriveUpload,
  Shield,
  FileSpreadsheet,
  Users,
  Activity,
  BarChart3,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: LayoutDashboard, label: "仪表盘", path: "/" },
  { icon: Database, label: "产品数据", path: "/data" },
  { icon: BarChart3, label: "分类统计", path: "/stats" },
  { icon: FileText, label: "变更记录", path: "/summary" },
  { icon: HardDriveUpload, label: "数据导入", path: "/import", permission: PERMISSIONS.IMPORT_DATA },
  { icon: FileSpreadsheet, label: "报价管理", path: "/quotations" },
  { icon: Users, label: "用户管理", path: "/users", permission: PERMISSIONS.MANAGE_USERS },
  { icon: Activity, label: "操作日志", path: "/activity", permission: PERMISSIONS.VIEW_ACTIVITY_LOGS },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    // Redirect to login
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    return <DashboardLayoutSkeleton />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find((item) => item.path === location);
  const visibleMenuItems = menuItems.filter((item: any) => {
    if (item.permission && !hasPermission(user!, item.permission)) return false;
    return true;
  });
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft =
        sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-9 w-9 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                {isCollapsed ? (
                  <PanelLeft className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                    <Shield className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold tracking-tight truncate text-sm">
                    ALE DAN CPL 系统
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 pt-2">
            <SidebarMenu className="px-2 py-1 space-y-0.5">
              {visibleMenuItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 transition-all font-normal"
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span className="text-sm">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors flex-1 min-w-0 text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Avatar className="h-9 w-9 border shrink-0">
                      <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                        {user?.name?.charAt(0).toUpperCase() || "A"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                      <p className="text-sm font-medium truncate leading-none">
                        {user?.name || "用户"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-1.5">
                        {user?.email || "管理员"}
                      </p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>退出登录</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {toggleTheme && (
                <button
                  onClick={toggleTheme}
                  className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-accent/50 transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={theme === "dark" ? "切换亮色模式" : "切换暗色模式"}
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Moon className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              )}
            </div>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        <div className="flex items-center justify-between h-11 px-4 border-b bg-background/80 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            {isMaximized && (
              <button
                onClick={() => { setIsMaximized(false); if (state === "collapsed") toggleSidebar(); }}
                className="group h-9 w-9 flex items-center justify-center rounded-md hover:bg-primary/10 hover:text-primary transition-colors"
                title="还原侧边栏"
              >
                <Minimize2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            )}
            <span className="text-xs text-muted-foreground font-medium">{activeMenuItem?.label ?? ""}</span>
          </div>
          <div className="flex items-center gap-1">
            {isMaximized ? (
              <button
                onClick={() => { setIsMaximized(false); if (state === "collapsed") toggleSidebar(); }}
                className="group h-9 w-9 flex items-center justify-center rounded-md border border-transparent hover:border-primary/20 hover:bg-primary/10 transition-colors"
                title="还原侧边栏"
              >
                <Minimize2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ) : (
              <button
                onClick={() => { setIsMaximized(true); if (state !== "collapsed") toggleSidebar(); }}
                className="group h-9 w-9 flex items-center justify-center rounded-md border border-transparent hover:border-primary/20 hover:bg-primary/10 transition-colors"
                title="全屏查看（折叠侧边栏）"
              >
                <Maximize2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            )}
          </div>
        </div>
        <main className="flex-1 p-5 lg:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
