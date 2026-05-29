﻿import { useAuth } from "@/_core/hooks/useAuth";
import { MobilePreviewProvider } from "@/contexts/MobilePreviewContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Building2,
  Activity,
  BarChart3,
  TrendingUp,
  Sun,
  Moon,
  Globe,
  Maximize2,
  Minimize2,
  Smartphone,
  Monitor,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const menuItems = [
  { icon: LayoutDashboard, labelKey: "menu.dashboard", path: "/" },
  { icon: FileSpreadsheet, labelKey: "menu.quotations", path: "/quotations" },
  { icon: Building2, labelKey: "menu.customers", path: "/customers" },
  { icon: Database, labelKey: "menu.products", path: "/data" },
  { icon: TrendingUp, labelKey: "menu.stats", path: "/stats" },
  { icon: FileText, labelKey: "menu.summary", path: "/summary" },
  { icon: HardDriveUpload, labelKey: "menu.import", path: "/import", permission: PERMISSIONS.IMPORT_DATA },
  { icon: Activity, labelKey: "menu.activity", path: "/activity", permission: PERMISSIONS.VIEW_ACTIVITY_LOGS },
  { icon: Users, labelKey: "menu.users", path: "/users", permission: PERMISSIONS.MANAGE_USERS },
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

function PageTransition({ children, location }: { children: React.ReactNode; location: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
    );
    // Stagger-animate child cards/sections
    gsap.fromTo(ref.current.querySelectorAll(".stagger-in"),
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, stagger: 0.06, duration: 0.35, ease: "power2.out", delay: 0.1 }
    );
  }, { dependencies: [location], scope: ref });

  return <div ref={ref}>{children}</div>;
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
  const { theme, toggleTheme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isMobilePreview, setIsMobilePreview] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find((item) => item.path === location);
  const activeLabel = activeMenuItem ? t(activeMenuItem.labelKey) : "";
  const visibleMenuItems = menuItems.filter((item: any) => {
    if (item.permission && !hasPermission(user!, item.permission)) return false;
    return true;
  });
  const isMobile = useIsMobile();
  const menuRef = useRef<HTMLDivElement>(null);

  // Initial menu items stagger animation
  useGSAP(() => {
    gsap.from(".menu-item", {
      x: -20,
      opacity: 0,
      stagger: 0.06,
      duration: 0.5,
      ease: "power2.out",
      delay: 0.2,
    });
  }, { scope: menuRef });

  // Animate menu items when sidebar expands from collapsed
  const prevStateRef = useRef(state);
  useGSAP(() => {
    if (prevStateRef.current === "collapsed" && state === "expanded") {
      gsap.fromTo(".menu-item span",
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, stagger: 0.04, duration: 0.3, ease: "power2.out", delay: 0.15 }
      );
    }
    prevStateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  // Mobile preview: collapse sidebar + set data attribute for useIsMobile override
  useEffect(() => {
    if (isMobilePreview && state !== "collapsed") {
      toggleSidebar();
    }
    document.documentElement.setAttribute("data-mobile-preview", isMobilePreview ? "true" : "false");
    return () => { document.documentElement.removeAttribute("data-mobile-preview"); };
  }, [isMobilePreview]);

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
          style={{ backgroundImage: "var(--sidebar-gradient)" }}
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
                    {t('layout.systemName')}
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 pt-2" ref={menuRef}>
            <SidebarMenu className="px-2 py-1 space-y-0.5">
              {visibleMenuItems.map((item) => {
                const isActive = location === item.path;
                const label = t(item.labelKey);
                return (
                  <SidebarMenuItem key={item.path} className="menu-item">
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={label}
                      className="h-10 transition-all font-normal"
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span className="text-sm">{label}</span>
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
                        {user?.name || t('user.defaultName')}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-1.5">
                        {user?.email || t('user.defaultRole')}
                      </p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => setLogoutOpen(true)}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t('user.logout')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SidebarFooter>

          {/* Logout Confirmation */}
          <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('user.confirmLogout')}</AlertDialogTitle>
                <AlertDialogDescription>{t('user.logoutWarning')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={logout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('user.confirmExit')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
                title={t('layout.restoreSidebar')}
              >
                <Minimize2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            )}
            <span className="text-xs text-muted-foreground font-medium">{activeLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            {/* Language Switcher — hidden in mobile preview */}
            {!isMobilePreview && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="group h-9 w-9 flex items-center justify-center rounded-md border border-transparent hover:border-primary/20 hover:bg-primary/10 transition-colors"
                  title={t('lang.label')}
                >
                  <Globe className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem onClick={() => i18n.changeLanguage("zh")} className="cursor-pointer">
                  <span className={i18n.language === "zh" ? "font-bold text-primary" : ""}>中文</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => i18n.changeLanguage("zh-TW")} className="cursor-pointer">
                  <span className={i18n.language === "zh-TW" ? "font-bold text-primary" : ""}>繁體中文</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => i18n.changeLanguage("en")} className="cursor-pointer">
                  <span className={i18n.language === "en" ? "font-bold text-primary" : ""}>English</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => i18n.changeLanguage("ja")} className="cursor-pointer">
                  <span className={i18n.language === "ja" ? "font-bold text-primary" : ""}>日本語</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => i18n.changeLanguage("es")} className="cursor-pointer">
                  <span className={i18n.language === "es" ? "font-bold text-primary" : ""}>Español</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => i18n.changeLanguage("fr")} className="cursor-pointer">
                  <span className={i18n.language === "fr" ? "font-bold text-primary" : ""}>Français</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            )}

            {/* Theme Toggle */}
            {toggleTheme && (
              <button
                onClick={toggleTheme}
                className="group h-9 w-9 flex items-center justify-center rounded-md border border-transparent hover:border-primary/20 hover:bg-primary/10 transition-colors"
                title={theme === "dark" ? t('theme.light') : t('theme.dark')}
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                ) : (
                  <Moon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                )}
              </button>
            )}

            {/* Mobile Preview Toggle */}
            <button
              onClick={() => setIsMobilePreview(prev => !prev)}
              className={`group h-9 w-9 flex items-center justify-center rounded-md border transition-colors ${isMobilePreview ? "border-primary/40 bg-primary/10 text-primary" : "border-transparent hover:border-primary/20 hover:bg-primary/10"}`}
              title={isMobilePreview ? t('layout.exitMobilePreview') : t('layout.mobilePreview')}
            >
              {isMobilePreview ? (
                <Monitor className="h-5 w-5 group-hover:text-primary transition-colors" />
              ) : (
                <Smartphone className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              )}
            </button>

            {/* Maximize/Minimize — hidden in mobile preview */}
            {!isMobilePreview && (isMaximized ? (
              <button
                onClick={() => { setIsMaximized(false); if (state === "collapsed") toggleSidebar(); }}
                className="group h-9 w-9 flex items-center justify-center rounded-md border border-transparent hover:border-primary/20 hover:bg-primary/10 transition-colors"
                title={t('layout.restoreSidebar')}
              >
                <Minimize2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ) : (
              <button
                onClick={() => { setIsMaximized(true); if (state !== "collapsed") toggleSidebar(); }}
                className="group h-9 w-9 flex items-center justify-center rounded-md border border-transparent hover:border-primary/20 hover:bg-primary/10 transition-colors"
                title={t('layout.maximize')}
              >
                <Maximize2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        </div>
        <MobilePreviewProvider value={isMobilePreview}>
        <main className={`flex-1 ${isMobilePreview ? "" : "p-5 lg:p-6"}`}>
          {isMobilePreview ? (
            <div className="flex justify-center py-4 px-4 h-full">
              <div className="w-[375px] h-full flex flex-col bg-background rounded-[2rem] border-[6px] border-foreground/10 shadow-2xl overflow-hidden relative">
                {/* Phone notch */}
                <div className="flex justify-center py-1.5 bg-muted/30">
                  <div className="w-20 h-4 bg-foreground/5 rounded-full" />
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <PageTransition location={location}>{children}</PageTransition>
                </div>
                {/* Phone home bar */}
                <div className="flex justify-center py-2 bg-muted/30">
                  <div className="w-24 h-1 bg-foreground/10 rounded-full" />
                </div>
              </div>
            </div>
          ) : (
            <PageTransition location={location}>{children}</PageTransition>
          )}
        </main>
        </MobilePreviewProvider>
      </SidebarInset>
    </>
  );
}
