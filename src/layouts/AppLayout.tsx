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
import { Menu, X, Radio, Activity, Bell, ChevronRight, Search } from "lucide-react";
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
import { useAuth } from "../hooks/useAuth";
import { normalizeRole } from "../services/auth/roleUtils";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { NetworkOfflineBanner } from "../components/feedback/NetworkOfflineBanner";
import { SkipLink } from "../a11y/SkipLink";

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
    background: "var(--bg-sidebar, #1a3a5c)",
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
  sectionTitle: (open: boolean): React.CSSProperties => ({
    padding: open ? "8px 16px 4px" : 0,
    fontSize: 12,
    fontWeight: 700,
    color: "var(--text-sidebar, #e2e8f0)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    opacity: open ? 0.85 : 0,
    height: open ? "auto" : 0,
    overflow: "hidden",
  }),
  navItem: (active: boolean, open: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: open ? "9px 14px" : "9px 20px",
    margin: "2px 8px",
    borderRadius: 6,
    cursor: "pointer",
    color: "var(--text-sidebar, #ffffff)",
    background: active ? "rgba(255,255,255,0.15)" : "transparent",
    borderLeft: active ? "4px solid #22c55e" : "4px solid transparent",
    fontSize: 14,
    fontWeight: active ? 700 : 500,
    transition: "all 0.15s",
    whiteSpace: "nowrap",
    textDecoration: "none",
    justifyContent: open ? "flex-start" : "center",
  }),
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
  breadcrumbItem: (current: boolean): React.CSSProperties => ({
    color: current
      ? "var(--text-header, #f1f5f9)"
      : "var(--text-muted, #64748b)",
    fontWeight: current ? 600 : 400,
    cursor: current ? "default" : "pointer",
    textDecoration: "none",
    padding: "2px 4px",
    borderRadius: 4,
  }),
};

function Breadcrumb({ pathname }: { pathname: string }) {
  const segments = pathname.split("/").filter(Boolean);
  const isHome = pathname === "/";

  if (isHome) {
    return (
      <nav aria-label="breadcrumb" style={s.breadcrumb}>
        <span style={s.breadcrumbItem(true)}>{t("nav.homeOverview")}</span>
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
            <span style={s.breadcrumbItem(true)} aria-current="page">
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
              style={s.breadcrumbItem(false)}
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
      style={{ ...s.navItem(active, open) }}
      onMouseEnter={(e) => {
        if (!active)
          e.currentTarget.style.background = "rgba(255,255,255,0.08)";
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [locale, setLocale] = useState<Locale>(getCurrentLocale());
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const { isOnline } = useNetworkStatus();
  const { user, isAuthenticated } = useAuth();
  const bp = useBreakpoint();
  const isNarrow = bp === "xs" || bp === "sm" || bp === "md";
  const filteredItems = useSidebarItems((user?.role as Role) ?? "医生");

  useEffect(() => onLocaleChange((l) => setLocale(l)), []);

  useEffect(() => {
    if (isNarrow) setSidebarOpen(false);
  }, [isNarrow]);

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

  return (
    <div style={{ ...s.root, direction }}>
      <SkipLink />
      <NavigateCtx.Provider value={navigate}>
        <aside
          className="app-sidebar no-print"
          style={{ ...s.sidebar, width: effectiveSidebarOpen ? 260 : 60 }}
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
                  style={s.sectionTitle(effectiveSidebarOpen)}
                  aria-hidden={!effectiveSidebarOpen}
                >
                  {t(section.section)}
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
              onClick={() => setSidebarOpen(!sidebarOpen)}
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
              onClick={() => setSidebarOpen(!sidebarOpen)}
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
                }}
              />
              <input
                type="text"
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
                  e.currentTarget.style.borderColor = "#3b82f6";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-color, #334155)";
                }}
              />
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
            <button style={s.headerBtn} aria-label={t("nav.notification")}>
              <Bell size={18} />
              <span
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  background: "var(--color-error, #ef4444)",
                  borderRadius: "50%",
                }}
                aria-hidden="true"
              />
            </button>
            <span
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
          className="print-area"
          tabIndex={-1}
          style={s.content}
          role="main"
        >
          <h1 className="sr-only">{`${t("app.title")} - ${sectionTitle || t("app.hospital")}`}</h1>
          <React.Suspense fallback={<Loading />}>
            <Routes>
              {routes.map((r) => (
                <Route key={r.path} {...r} />
              ))}
            </Routes>
          </React.Suspense>
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
