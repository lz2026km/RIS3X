/**
 * G005 放射RIS系统 v3.0.2.9 - AppLayout JSX 重构
 * v3.0.6.8-23c (A1): 全局布局 + z-index 体系重构
 *   - P0-1: 通知徽章定位 (headerBtn position: relative)
 *   - P0-2: Loading Suspense fallback 加 z-index/定位
 *   - P1-H1: Header position: sticky; top:0; z-index: var(--z-sticky)
 *   - P1-H3: Header 加自动面包屑 (从 routeTable 路径 + nav.* i18n)
 *   - P1-S1: 侧栏响应式 (useBreakpoint 窄屏自动折叠)
 *   - P1-M1: Content 区加 padding/margin + min-height
 *   - P1-M3: 侧栏底部双 profileBottom 合并
 *   - P1-S2/S3: 侧栏菜单项字号 20px → 14px,section 标题统一
 *   - P2-1: z-index 全部走 CSS 变量令牌
 *   - P2-2: SEO H1 移到 <header> 元素,移除 absolute 偏移
 *   - P2-8: 引入 getBreadcrumbLabel 工具,统一面包屑查找
 */
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  createContext,
  useContext,
} from "react";
import {
  Navigate,
  useNavigate,
  useLocation,
  Routes,
  Route,
} from "react-router-dom";
import { Menu, X, Radio, Activity, Bell, ChevronRight, Search, Sun, Moon, Contrast, Settings, LayoutDashboard, Users, FileText, ShieldCheck, GitBranch, Printer, Sparkles, Network, UserCheck, BarChart3, DollarSign, FileSpreadsheet, Eye, LayoutGrid, Package, Stethoscope } from "lucide-react";
import { Badge } from "antd";
import {
  SIDEBAR_ITEMS,
  type Role,
  type SidebarItem,
  type SidebarSection,
} from "../routes/sidebarConfig";
import {
  t,
  onLocaleChange,
  getCurrentLocale,
  getDirection,
  type Locale,
} from "../i18n/appI18n";
import { routes } from "../routes/routeTable";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { buildMeta } from "../utils/appInfo";
import { useAuth } from "../hooks/useAuth";
import { normalizeRole } from "../services/auth/roleUtils";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useUserConfig } from "../hooks/useUserConfig";
import { useAppTheme, type ThemeMode } from "../components/Provider";
// [W14-UX] 全局快捷键注册中心 + 帮助浮层
import { useGlobalShortcuts } from "../hooks/useGlobalShortcuts";
import { ShortcutHelpModal } from "../components/common/ShortcutHelpModal";
import { SettingsPanel } from "../components/feedback/SettingsPanel";
import { NetworkOfflineBanner } from "../components/feedback/NetworkOfflineBanner";
import { SkipLink } from "../a11y/SkipLink";
// [W1-B] 铃铛未读数: notificationsApi.getUnread (GET /notifications/unread/:userId)
import { notificationsApi } from "../services/api/notificationsApi";

const NavigateCtx = createContext<(path: string) => void>(() => {});
export const useNav = (): ((path: string) => void) => useContext(NavigateCtx);

function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--z-modal, 500)" as unknown as number,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary, #0f172a)",
        color: "var(--text-muted, #64748b)",
        fontSize: 14,
        gap: 12,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: "3px solid var(--border-color, #334155)",
          borderTopColor: "var(--color-primary-500, #3b82f6)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      {t("app.loading")}
    </div>
  );
}

function useSidebarItems(role: Role): SidebarSection[] {
  return useMemo(
    () =>
      SIDEBAR_ITEMS.map((section) => ({
        ...section,
        // v3.0.6.11-73: 角色比较统一归一化 (中文 '管理员' 与英文 'ADMIN' 均匹配)
        items: section.items.filter((item) =>
          item.roles.some((r) => normalizeRole(r) === normalizeRole(role)),
        ),
      })).filter((section) => section.items.length > 0),
    [role],
  );
}

const pathToItemMap: Map<string, SidebarItem> = (() => {
  const m = new Map<string, SidebarItem>();
  for (const section of SIDEBAR_ITEMS) {
    for (const item of section.items) {
      m.set(item.path, item);
    }
  }
  return m;
})();

function getBreadcrumbLabel(path: string): string {
  if (path === "/") return t("nav.homeOverview");
  const item = pathToItemMap.get(path);
  if (item) return t(item.labelKey);
  const segments = path.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  return t(`nav.${last}`) || last;
}

function getSectionForPath(path: string): string {
  for (const section of SIDEBAR_ITEMS) {
    if (section.items.some((item) => item.path === path)) {
      return t(section.section);
    }
  }
  return "";
}

const s: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    height: "100vh",
    background: "var(--bg-primary, #f8fafc)",
  },
  sidebar: {
    background: "var(--bg-sidebar, #172554)",
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid var(--border-color, #475569)",
    transition: "width 0.2s",
    overflow: "hidden",
    flexShrink: 0,
  },
  logoWrap: {
    padding: "16px 14px",
    borderBottom: "1px solid var(--border-color, #475569)",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: {
    width: 32,
    height: 32,
    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  nav: { flex: 1, overflowY: "auto", padding: "8px 0" },
  collapseBtn: {
    width: "100%",
    padding: 8,
    borderRadius: 8,
    border: "1px solid var(--border-color, #475569)",
    background: "var(--bg-deep, #0f172a)",
    color: "var(--text-muted, #94a3b8)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontSize: 12,
  },
  userCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 6px",
    borderRadius: 6,
    cursor: "pointer",
  },
  avatar: {
    width: 28,
    height: 28,
    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    minWidth: 0,
  },
  header: {
    height: 52,
    background: "var(--bg-header, #1e293b)",
    borderBottom: "1px solid var(--border-color, #475569)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
    flexShrink: 0,
    position: "sticky" as const,
    top: 0,
    zIndex: "var(--z-sticky, 200)" as unknown as number,
  },
  headerBtn: {
    position: "relative" as const,
    background: "none",
    border: "none",
    color: "var(--text-secondary, #c8ccd4)",
    cursor: "pointer",
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  content: {
    flex: 1,
    overflow: "auto",
    background: "var(--bg-primary, #f8fafc)",
    padding: "16px 20px",
    minHeight: 0,
  },
  profileBottom: {
    padding: "12px 8px",
    borderTop: "1px solid var(--border-color, #475569)",
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 13,
    color: "var(--text-muted, #64748b)",
    minWidth: 0,
    overflow: "hidden",
    whiteSpace: "nowrap" as const,
  },
};

const sectionTitleStyle = (open: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: open ? "10px 14px 4px" : 0,
  marginLeft: open ? 8 : 0,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.02em",
  color: "var(--text-sidebar, rgba(241,245,249,0.72))",
  textTransform: "none",
  opacity: open ? 0.9 : 0,
  height: open ? "auto" : 0,
  overflow: "hidden",
  whiteSpace: "nowrap" as const,
});

const navItemStyle = (active: boolean, open: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: open ? "9px 14px" : "9px 20px",
  margin: "2px 8px",
  borderRadius: 6,
  cursor: "pointer",
  color: "var(--text-sidebar, #ffffff)",
  background: active
    ? "var(--sidebar-item-active-bg, rgba(37, 99, 235, 0.22))"
    : "transparent",
  borderLeft: active
    ? "4px solid var(--color-primary-600, #2563eb)"
    : "4px solid transparent",
  fontSize: 14,
  fontWeight: active ? 700 : 500,
  transition: "all 0.15s",
  whiteSpace: "nowrap",
  textDecoration: "none",
  justifyContent: open ? "flex-start" : "center",
});

const breadcrumbItemStyle = (current: boolean): React.CSSProperties => ({
  color: current
    ? "var(--text-header, #f1f5f9)"
    : "var(--text-muted, #64748b)",
  fontWeight: current ? 600 : 400,
  cursor: current ? "default" : "pointer",
  textDecoration: "none",
  padding: "2px 4px",
  borderRadius: 4,
});

// U1-B: Header 主题切换按钮 — 浅色/深色/高对比度 三态图标
const THEME_META: Record<
  ThemeMode,
  { icon: React.ReactNode; labelKey: string }
> = {
  light: { icon: <Sun size={18} />, labelKey: "app.themeLight" },
  dark: { icon: <Moon size={18} />, labelKey: "app.themeDark" },
  "high-contrast": {
    icon: <Contrast size={18} />,
    labelKey: "app.themeHighContrast",
  },
};

// W4A-C4: 侧边栏分组标题图标 (lucide, 与 sidebarConfig 图标体系一致)
const SECTION_ICONS: Record<string, React.ReactNode> = {
  "nav.workbench": <LayoutDashboard size={12} />,
  "nav.patientManagement": <Users size={12} />,
  "nav.reportManagement": <FileText size={12} />,
  "nav.qualityControlV3": <ShieldCheck size={12} />,
  "nav.qualityControl": <ShieldCheck size={12} />,
  "nav.workflowV3": <GitBranch size={12} />,
  "nav.imagingPrint": <Printer size={12} />,
  "nav.aiIntelligence": <Sparkles size={12} />,
  "nav.regionalCoordination": <Network size={12} />,
  "nav.dicomNetwork": <Radio size={12} />,
  "nav.patientService": <UserCheck size={12} />,
  "nav.dataAnalysis": <BarChart3 size={12} />,
  "nav.revenue": <DollarSign size={12} />,
  "nav.dataReport": <FileSpreadsheet size={12} />,
  "nav.eyeSpecialty": <Eye size={12} />,
  "nav.specialtyModules": <LayoutGrid size={12} />,
  "nav.dentalSpecialty": <Stethoscope size={12} />,
  "nav.systemManage": <Settings size={12} />,
  "nav.equipmentMaterials": <Package size={12} />,
};

function Breadcrumb({ pathname }: { pathname: string }) {
  const segments = pathname.split("/").filter(Boolean);
  const isHome = pathname === "/";

  if (isHome) {
    return (
      <nav aria-label="breadcrumb" style={s.breadcrumb}>
        <span style={breadcrumbItemStyle(true)}>{t("nav.homeOverview")}</span>
      </nav>
    );
  }

  const crumbs: Array<{ path: string; label: string; current: boolean }> = [];
  crumbs.push({ path: "/", label: t("nav.homeOverview"), current: false });
  let acc = "";
  for (const seg of segments) {
    acc += `/${seg}`;
    crumbs.push({
      path: acc,
      label: getBreadcrumbLabel(acc),
      current: acc === pathname,
    });
  }

  return (
    <nav aria-label="breadcrumb" style={s.breadcrumb}>
      {crumbs.map((c, i) => (
        <React.Fragment key={c.path}>
          {i > 0 && (
            <ChevronRight
              size={12}
              style={{ flexShrink: 0, color: "var(--text-muted, #64748b)" }}
            />
          )}
          {c.current ? (
            <span style={breadcrumbItemStyle(true)} aria-current="page">
              {c.label}
            </span>
          ) : (
            <a
              href={c.path}
              role="link"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, "", c.path);
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  window.history.pushState({}, "", c.path);
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }
              }}
              style={breadcrumbItemStyle(false)}
            >
              {c.label}
            </a>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

interface NavItemProps {
  path: string;
  labelKey: string;
  icon: React.ReactNode;
  active: boolean;
  open: boolean;
  onNavigate: (path: string) => void;
  onKeyNav: (e: React.KeyboardEvent, path: string) => void;
  badgeCount?: number;
}

const NavItem = React.memo(function NavItem({
  path,
  labelKey,
  icon,
  active,
  open,
  onNavigate,
  onKeyNav,
  badgeCount,
}: NavItemProps) {
  const label = t(labelKey);
  return (
    <a
      href={path}
      role="link"
      tabIndex={0}
      data-testid={`nav-${path}`}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      title={!open ? label : undefined}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(path);
      }}
      onKeyDown={(e) => onKeyNav(e, path)}
      style={{ ...navItemStyle(active, open) }}
      onMouseEnter={(e) => {
        if (!active)
          e.currentTarget.style.background =
            "var(--sidebar-item-hover-bg, rgba(37, 99, 235, 0.14))";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={{ flexShrink: 0, display: "inline-flex" }}>{icon}</span>
      {open && <span>{label}</span>}
      {badgeCount !== undefined && badgeCount > 0 && (
        <span
          style={{
            marginLeft: "auto",
            background: "var(--color-error, #ef4444)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 5px",
            lineHeight: 1,
          }}
        >
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
    </a>
  );
});

export function AppLayout() {
  const userConfig = useUserConfig();
  // [W4A-C3] 折叠状态持久化: UserConfig.sidebarCollapsed (localStorage)
  const [sidebarOpen, setSidebarOpen] = useState(
    () => !userConfig.config.sidebarCollapsed,
  );
  const [locale, setLocale] = useState<Locale>(getCurrentLocale());
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const { isOnline } = useNetworkStatus();
  const { user, isAuthenticated } = useAuth();
  const bp = useBreakpoint();
  const isNarrow = bp === "xs" || bp === "sm" || bp === "md";
  const filteredItems = useSidebarItems((user?.role as Role) ?? "医生");
  const { theme: appTheme, cycleTheme } = useAppTheme();

  // [W14-UX] 全局快捷键 (导航序列键 g+x / Ctrl+K 搜索 / Alt+T 主题 / ? 与 F1 帮助)
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { shortcuts: globalShortcuts, helpOpen, closeHelp } = useGlobalShortcuts({
    navigate,
    onToggleTheme: cycleTheme,
    onRefresh: () =>
      window.dispatchEvent(new CustomEvent("g005:refresh")),
    onSearch: () => {
      setSearchOpen(true);
      requestAnimationFrame(() => searchInputRef.current?.focus());
    },
  });

  // [W4A-C7] Header 搜索: 路由名匹配下拉 (sidebarConfig labelKey 中文)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const hits: Array<{ path: string; label: string }> = [];
    for (const section of SIDEBAR_ITEMS) {
      for (const item of section.items) {
        const label = t(item.labelKey);
        if (
          label.toLowerCase().includes(q) ||
          item.path.toLowerCase().includes(q)
        ) {
          hits.push({ path: item.path, label });
        }
      }
    }
    return hits.slice(0, 10);
  }, [searchQuery]);

  useEffect(() => onLocaleChange((l) => setLocale(l)), []);

  useEffect(() => {
    if (isNarrow) setSidebarOpen(false);
  }, [isNarrow]);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      userConfig.updateField("sidebarCollapsed", !next);
      return next;
    });
  };

  // [W1-B] 铃铛未读数 (GET /notifications/unread/:userId, 后端限定 ADMIN/DIRECTOR), 点击跳转通知中心
  // [W1-107] Hook 必须早于任何提前 return, 否则登录态切换时 "Rendered fewer hooks" 全站崩溃
  const [unreadCount, setUnreadCount] = useState(0);
  const canReadUnread = useMemo(() => {
    const role = String(user?.role ?? "");
    return role === "ADMIN" || role === "DIRECTOR" || role === "管理员" || role === "主任";
  }, [user?.role]);
  useEffect(() => {
    const uid = user?.id;
    if (!uid || !canReadUnread) return;
    let cancelled = false;
    const loadUnread = () => {
      notificationsApi.getUnread(uid).then(res => {
        if (!cancelled && res.success && res.data) setUnreadCount(Number(res.data.unread ?? 0));
      }).catch(() => { /* 未读数不可用不阻断 */ });
    };
    loadUnread();
    const iv = setInterval(loadUnread, 60000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [user?.id, canReadUnread]);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const currentUser = user;
  const direction = getDirection(locale);
  const effectiveSidebarOpen = isNarrow ? false : sidebarOpen;

  const handleNavKey = (e: React.KeyboardEvent, path: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate(path);
    }
  };

  const sectionTitle = getSectionForPath(location.pathname);

  // [W5] 侧边栏版本号: VITE_APP_VERSION > index.html __appVersion > i18n app.version
  const appVersion =
    import.meta.env.VITE_APP_VERSION ||
    (typeof window !== "undefined"
      ? (window as { __appVersion?: string }).__appVersion
      : undefined) ||
    t("app.version");

  // [W3-B] VITE_GIT_SHA / VITE_BUILD_TIME 接入: 版本行 tooltip 展示构建元信息
  const versionTooltip = (() => {
    const meta = buildMeta();
    return meta ? `${appVersion} (${meta})` : appVersion;
  })();

  return (
    <div style={{ ...s.root, direction }}>
      <SkipLink />
      <ShortcutHelpModal open={helpOpen} onClose={closeHelp} shortcuts={globalShortcuts} />
      <NavigateCtx.Provider value={navigate}>
        <aside
          className="app-sidebar no-print"
          style={{
            ...s.sidebar,
            width: effectiveSidebarOpen
              ? "var(--sidebar-w, 260px)"
              : "var(--sidebar-w-collapsed, 60px)",
          }}
          aria-label={t("app.sidebar")}
        >
          <div style={s.logoWrap}>
            <div style={s.logoIcon}>
              <Radio size={18} color="#fff" />
            </div>
            {effectiveSidebarOpen && (
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--text-header, #f0f2f5)",
                  }}
                >
                  {t("app.title")}
                </div>
                <div
                  style={{ fontSize: 12, color: "var(--text-muted, #94a3b8)" }}
                  title={versionTooltip}
                >
                  {appVersion}
                </div>
              </div>
            )}
          </div>
          <nav style={s.nav} aria-label={t("app.nav")}>
            {filteredItems.map((section, idx) => (
              <div key={idx} style={{ marginBottom: 16 }}>
                <div
                  style={sectionTitleStyle(effectiveSidebarOpen)}
                  aria-hidden={!effectiveSidebarOpen}
                >
                  <span
                    style={{
                      width: 3,
                      height: 12,
                      borderRadius: 2,
                      background: "var(--color-primary-500, #3b82f6)",
                      flexShrink: 0,
                      opacity: effectiveSidebarOpen ? 1 : 0,
                    }}
                  />
                  {SECTION_ICONS[section.section] ?? null}
                  <span>{t(section.section)}</span>
                </div>
                {section.items.map((item) => (
                  <NavItem
                    key={item.path}
                    path={item.path}
                    labelKey={item.labelKey}
                    icon={item.icon}
                    active={isActive(item.path)}
                    open={effectiveSidebarOpen}
                    onNavigate={navigate}
                    onKeyNav={handleNavKey}
                    badgeCount={(item as any).badgeCount}
                  />
                ))}
              </div>
            ))}
          </nav>
          <div style={s.profileBottom}>
            <div
              style={s.userCard}
              aria-label={currentUser.name}
              title={currentUser.name}
            >
              <div style={s.avatar}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                  {currentUser.name.slice(0, 1)}
                </span>
              </div>
              {effectiveSidebarOpen && (
                <div style={{ overflow: "hidden" }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-header, #f1f5f9)",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                    }}
                  >
                    {currentUser.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted, #94a3b8)",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                    }}
                  >
                    {currentUser.title || currentUser.role}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={toggleSidebar}
              style={s.collapseBtn}
              aria-label={
                effectiveSidebarOpen ? t("app.collapse") : t("app.expand")
              }
              disabled={isNarrow}
            >
              {effectiveSidebarOpen ? (
                <>
                  <X size={14} />
                  {t("app.collapse")}
                </>
              ) : (
                <>
                  <Menu size={14} />
                  {t("app.expand")}
                </>
              )}
            </button>
          </div>
        </aside>
      </NavigateCtx.Provider>
      <div style={s.main}>
        <header className="app-header no-print" style={s.header}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
              flex: 1,
            }}
          >
            <button
              onClick={toggleSidebar}
              style={s.headerBtn}
              aria-label={
                effectiveSidebarOpen ? t("app.collapse") : t("app.expand")
              }
            >
              {effectiveSidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <span
              style={{
                fontSize: 14,
                color: "var(--text-header, #f1f5f9)",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {t("app.hospital")}
            </span>
            <span
              style={{
                color: "var(--text-muted, #94a3b8)",
                fontSize: 14,
                margin: "0 4px",
                userSelect: "none",
              }}
              aria-hidden="true"
            >
              |
            </span>
            <Breadcrumb pathname={location.pathname} />
            <div
              className="hide-xs"
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                marginLeft: 16,
              }}
            >
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: 10,
                  color: "var(--text-muted, #64748b)",
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              />
              <input
                type="text"
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                placeholder={t("app.searchPlaceholder") || "搜索患者/检查号/报告..."}
                aria-label={t("app.searchPlaceholder") || "搜索患者/检查号/报告"}
                style={{
                  width: 240,
                  height: 32,
                  padding: "0 12px 0 32px",
                  borderRadius: 6,
                  border: "1px solid var(--border-color, #475569)",
                  background: "var(--bg-deep, #0f172a)",
                  color: "var(--text-header, #f1f5f9)",
                  fontSize: 13,
                  outline: "none",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-primary-500, #3b82f6)";
                  setSearchOpen(true);
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-color, #334155)";
                  setSearchOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchResults.length > 0) {
                    const first = searchResults[0];
                    if (first) {
                      navigate(first.path);
                      setSearchOpen(false);
                      setSearchQuery("");
                    }
                  } else if (e.key === "Escape") {
                    setSearchOpen(false);
                  }
                }}
              />
              {searchOpen && searchResults.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: 36,
                    left: 0,
                    right: 0,
                    background: "var(--bg-card, #ffffff)",
                    color: "var(--text-primary, #1e293b)",
                    border: "1px solid var(--border-color, #e2e8f0)",
                    borderRadius: 8,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                    zIndex: "var(--z-dropdown, 300)" as unknown as number,
                    maxHeight: 320,
                    overflowY: "auto" as const,
                    overflowX: "hidden",
                  }}
                  role="listbox"
                >
                  {searchResults.map((r) => (
                    <div
                      key={r.path}
                      role="option"
                      aria-selected={false}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        navigate(r.path);
                        setSearchOpen(false);
                        setSearchQuery("");
                      }}
                      style={{
                        padding: "8px 12px",
                        fontSize: 13,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        borderBottom: "1px solid var(--border-subtle, rgba(0,0,0,0.06))",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "var(--color-primary-50, #eff6ff)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <Search
                        size={12}
                        style={{ color: "var(--text-muted, #94a3b8)", flexShrink: 0 }}
                      />
                      <span style={{ whiteSpace: "nowrap" }}>{r.label}</span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: 11,
                          color: "var(--text-muted, #94a3b8)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.path}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexShrink: 0,
            }}
          >
            <div
              className="hide-xs"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "var(--text-muted, #94a3b8)",
              }}
            >
              <Activity size={14} style={{ color: "#22c55e" }} />
              <span>{t("app.systemStatus")}</span>
            </div>
            <button
              style={s.headerBtn}
              onClick={cycleTheme}
              aria-label={`${t("app.theme")}: ${t(THEME_META[appTheme].labelKey)}`}
              title={`${t("app.theme")}: ${t(THEME_META[appTheme].labelKey)} · ${t("app.themeSwitchHint")}`}
            >
              {THEME_META[appTheme].icon}
            </button>
            <SettingsPanel
              config={userConfig.config}
              updateConfig={userConfig.updateConfig}
              resetConfig={userConfig.resetConfig}
              updateField={userConfig.updateField}
              trigger={
                <Settings
                  size={18}
                  style={{ color: "var(--text-secondary, #c8ccd4)" }}
                />
              }
            />
            <Badge
              count={unreadCount}
              size="small"
              overflowCount={99}
              offset={[0, 2]}
            >
              <button
                style={s.headerBtn}
                aria-label={t("nav.notification")}
                title={
                  unreadCount > 0
                    ? `${unreadCount} 条未读通知`
                    : t("nav.notification")
                }
                onClick={() => navigate("/notification-center")}
              >
                <Bell size={18} />
              </button>
            </Badge>
            <span
              className="hide-xs"
              style={{
                fontSize: 13,
                color: "var(--text-secondary, #c8ccd4)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {new Date().toLocaleDateString(
                locale === "en-US" ? "en-US" : "zh-CN",
              )}
            </span>
          </div>
        </header>
        {!isOnline && <NetworkOfflineBanner />}
        <div
          id="main-content"
          key={location.pathname}
          className="print-area anim-fade-in"
          tabIndex={-1}
          style={s.content}
          role="main"
        >
          <h1 className="sr-only">{`${t("app.title")} - ${sectionTitle || t("app.hospital")}`}</h1>
          <React.Suspense fallback={<Loading />}>
            <Routes>
              {routes.map((r) => (
                <Route key={r.path} path={r.path} element={r.element} />
              ))}
            </Routes>
          </React.Suspense>
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
