"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandPalette } from "./command-palette";
import { QuickAdd } from "./quick-add";
import { createClient } from "@/lib/supabase/client";
import {
  ActivityIcon,
  BarChartIcon,
  CalendarCheckIcon,
  CalendarIcon,
  ChevronRightIcon,
  CommandIcon,
  FileTextIcon,
  FlaskIcon,
  GraduationCapIcon,
  HomeIcon,
  LibraryIcon,
  ListChecksIcon,
  LogOutIcon,
  MoreHorizontalIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  SettingsIcon,
  TimelineIcon,
  TrophyIcon,
  UserIcon,
  UsersIcon,
  type IconComponent,
} from "./icons";

type NavItem = { href: string; label: string; also?: string[]; Icon: IconComponent };

// Same destinations and sub-routes as before, grouped for the sidebar.
const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Home", Icon: HomeIcon },
      { href: "/today", label: "Today", also: ["/week", "/actions-list", "/timeline", "/wins"], Icon: CalendarCheckIcon },
    ],
  },
  {
    label: "Applications",
    items: [
      { href: "/schools", label: "Schools", also: ["/compare", "/readiness"], Icon: GraduationCapIcon },
      { href: "/outreach", label: "Outreach", Icon: SendIcon },
      { href: "/people", label: "People", Icon: UsersIcon },
    ],
  },
  {
    label: "Work",
    items: [
      { href: "/tasks", label: "Tasks", Icon: ListChecksIcon },
      { href: "/research", label: "Research", also: ["/links"], Icon: FlaskIcon },
      { href: "/materials", label: "Materials", Icon: FileTextIcon },
    ],
  },
];

const MOBILE = [
  { href: "/", label: "Home" },
  { href: "/today", label: "Today" },
  { href: "/schools", label: "Schools" },
  { href: "/tasks", label: "Tasks" },
];

const MORE = [
  { href: "/week", label: "This week" },
  { href: "/compare", label: "Compare schools" },
  { href: "/readiness", label: "Readiness" },
  { href: "/outreach", label: "Outreach" },
  { href: "/materials", label: "Materials" },
  { href: "/research", label: "Research" },
  { href: "/links", label: "Library" },
  { href: "/timeline", label: "Timeline" },
  { href: "/wins", label: "Wins" },
  { href: "/people", label: "People" },
  { href: "/account", label: "Account" },
];

const ICON_FOR: Record<string, IconComponent> = {
  "/": HomeIcon,
  "/today": CalendarCheckIcon,
  "/schools": GraduationCapIcon,
  "/tasks": ListChecksIcon,
  "/week": CalendarIcon,
  "/compare": BarChartIcon,
  "/readiness": ActivityIcon,
  "/outreach": SendIcon,
  "/materials": FileTextIcon,
  "/research": FlaskIcon,
  "/links": LibraryIcon,
  "/timeline": TimelineIcon,
  "/wins": TrophyIcon,
  "/people": UsersIcon,
  "/account": SettingsIcon,
};

// Breadcrumb trail per route, most specific first. A further path segment (an id) adds "Details".
type Crumb = { label: string; href?: string };
const CRUMBS: Array<{ match: string; trail: Crumb[] }> = [
  { match: "/materials/resume", trail: [{ label: "Work" }, { label: "Materials", href: "/materials" }, { label: "Resume builder", href: "/materials/resume" }] },
  { match: "/materials/statements", trail: [{ label: "Work" }, { label: "Materials", href: "/materials" }, { label: "Statements", href: "/materials/statements" }] },
  { match: "/materials/letters", trail: [{ label: "Work" }, { label: "Materials", href: "/materials" }, { label: "Letters", href: "/materials/letters" }] },
  { match: "/materials/documents", trail: [{ label: "Work" }, { label: "Materials", href: "/materials" }, { label: "Documents", href: "/materials/documents" }] },
  { match: "/materials", trail: [{ label: "Work" }, { label: "Materials", href: "/materials" }, { label: "Overview", href: "/materials" }] },
  { match: "/research/projects", trail: [{ label: "Work" }, { label: "Research", href: "/research" }, { label: "Projects", href: "/research" }] },
  { match: "/research", trail: [{ label: "Work" }, { label: "Research", href: "/research" }] },
  { match: "/links", trail: [{ label: "Work" }, { label: "Research", href: "/research" }, { label: "Library", href: "/links" }] },
  { match: "/tasks", trail: [{ label: "Work" }, { label: "Tasks", href: "/tasks" }] },
  { match: "/today", trail: [{ label: "Overview" }, { label: "Today", href: "/today" }] },
  { match: "/week", trail: [{ label: "Overview" }, { label: "Today", href: "/today" }, { label: "This week", href: "/week" }] },
  { match: "/timeline", trail: [{ label: "Overview" }, { label: "Today", href: "/today" }, { label: "Timeline", href: "/timeline" }] },
  { match: "/wins", trail: [{ label: "Overview" }, { label: "Today", href: "/today" }, { label: "Wins", href: "/wins" }] },
  { match: "/actions-list", trail: [{ label: "Overview" }, { label: "Action list", href: "/actions-list" }] },
  { match: "/schools", trail: [{ label: "Applications" }, { label: "Schools", href: "/schools" }] },
  { match: "/compare", trail: [{ label: "Applications" }, { label: "Schools", href: "/schools" }, { label: "Compare", href: "/compare" }] },
  { match: "/readiness", trail: [{ label: "Applications" }, { label: "Schools", href: "/schools" }, { label: "Readiness", href: "/readiness" }] },
  { match: "/outreach", trail: [{ label: "Applications" }, { label: "Outreach", href: "/outreach" }] },
  { match: "/people", trail: [{ label: "Applications" }, { label: "People", href: "/people" }] },
  { match: "/account", trail: [{ label: "Settings" }, { label: "Account", href: "/account" }] },
];

function crumbsFor(pathname: string): Crumb[] {
  if (pathname === "/") return [{ label: "Overview" }, { label: "Home", href: "/" }];
  const hit = CRUMBS.find((c) => pathname === c.match || pathname.startsWith(c.match + "/"));
  if (!hit) return [];
  const rest = pathname.slice(hit.match.length);
  return /^\/[^/]+/.test(rest) ? [...hit.trail, { label: "Details" }] : hit.trail;
}

const SIDEBAR_KEY = "cc.sidebar.collapsed";

export function NavShell({ children, isOwner }: { children: React.ReactNode; isOwner: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string, also: string[] = []) =>
    href === "/" ? pathname === "/" : [href, ...also].some((h) => pathname.startsWith(h));

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMoreOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  // Remember the collapsed sidebar in this browser only.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      /* storage unavailable: start expanded */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(SIDEBAR_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  }

  // Close the account menu on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function signOut() {
    await createClient().auth.signOut();
    window.location.href = "/login";
  }

  const crumbs = crumbsFor(pathname);
  const sectionTitle = crumbs.find((c, i) => i === 1)?.label ?? "Command Center";

  const navItemClass = (active: boolean) =>
    `group relative flex h-9 items-center gap-3 rounded-md text-sm transition-colors ${
      collapsed ? "justify-center px-0" : "px-3"
    } ${
      active
        ? "bg-blue-50 font-semibold text-blue-700"
        : "font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
    }`;

  const tooltip = (label: string) =>
    collapsed && (
      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {label}
      </span>
    );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* ── Desktop sidebar ── */}
      <aside
        className={`sticky top-0 z-30 hidden h-screen flex-shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-150 md:flex ${
          collapsed ? "w-16" : "w-[248px]"
        }`}
      >
        <div className={`flex h-14 flex-shrink-0 items-center gap-2.5 border-b border-slate-200 ${collapsed ? "justify-center" : "px-[18px]"}`}>
          <Link href="/" aria-label="Command Center home" className="flex items-center gap-2.5 rounded-md">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[7px] bg-blue-600 text-white">
              <CommandIcon className="h-4 w-4" />
            </span>
            {!collapsed && <span className="whitespace-nowrap text-[15px] font-semibold tracking-tight text-slate-900">Command Center</span>}
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-visible p-3" aria-label="Main navigation">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? "mt-4" : ""}>
              {collapsed ? (
                gi > 0 && <div className="mx-2 mb-3 h-px bg-slate-200" aria-hidden="true" />
              ) : (
                <div className="px-3 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{group.label}</div>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href, item.also);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      className={navItemClass(active)}
                    >
                      {active && !collapsed && (
                        <span className="absolute -left-3 bottom-2 top-2 w-[3px] rounded-r bg-blue-600" aria-hidden="true" />
                      )}
                      <item.Icon className={`h-[18px] w-[18px] flex-shrink-0 ${active ? "text-blue-600" : "text-slate-500 group-hover:text-slate-700"}`} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {tooltip(item.label)}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="flex flex-shrink-0 flex-col gap-0.5 border-t border-slate-200 p-3">
          <Link
            href="/account"
            aria-current={isActive("/account") ? "page" : undefined}
            aria-label={collapsed ? "Account" : undefined}
            className={navItemClass(isActive("/account"))}
          >
            {isActive("/account") && !collapsed && (
              <span className="absolute -left-3 bottom-2 top-2 w-[3px] rounded-r bg-blue-600" aria-hidden="true" />
            )}
            <SettingsIcon className={`h-[18px] w-[18px] flex-shrink-0 ${isActive("/account") ? "text-blue-600" : "text-slate-500"}`} />
            {!collapsed && <span>Account</span>}
            {tooltip("Account")}
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className={navItemClass(false)}
          >
            {collapsed ? (
              <PanelLeftOpenIcon className="h-[18px] w-[18px] flex-shrink-0 text-slate-500" />
            ) : (
              <PanelLeftCloseIcon className="h-[18px] w-[18px] flex-shrink-0 text-slate-500" />
            )}
            {!collapsed && <span>Collapse</span>}
            {tooltip("Expand sidebar")}
          </button>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop topbar */}
        <header className="sticky top-0 z-20 hidden h-14 flex-shrink-0 items-center gap-4 border-b border-slate-200 bg-white/95 px-6 backdrop-blur md:flex">
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex items-center gap-1.5 text-[13px]">
              {crumbs.map((c, i) => {
                const last = i === crumbs.length - 1;
                return (
                  <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
                    {i > 0 && <ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />}
                    {last ? (
                      <span aria-current="page" className="truncate font-medium text-slate-900">{c.label}</span>
                    ) : c.href ? (
                      <Link href={c.href} className="truncate text-slate-600 hover:text-slate-900">{c.label}</Link>
                    ) : (
                      <span className="truncate text-slate-500">{c.label}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 w-[280px] flex-shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-slate-50 pl-3 pr-2 text-[13px] text-slate-500 transition-colors hover:border-slate-400 hover:bg-white"
          >
            <SearchIcon className="h-4 w-4" />
            <span className="flex-1 text-left">Search or jump to…</span>
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-px font-mono text-[11px] text-slate-600">Ctrl K</kbd>
          </button>

          {isOwner && (
            <button
              type="button"
              onClick={() => setQuickOpen(true)}
              className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-md bg-blue-600 pl-2.5 pr-3 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <PlusIcon className="h-4 w-4" />
              Quick add
              <kbd className="ml-0.5 hidden rounded border border-blue-400 px-1 font-mono text-[11px] font-normal text-blue-50 lg:inline">Ctrl J</kbd>
            </button>
          )}

          <div ref={menuRef} className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
            >
              <UserIcon className="h-[18px] w-[18px]" />
            </button>
            {menuOpen && (
              <div role="menu" aria-label="Account" className="absolute right-0 top-11 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-md">
                <Link
                  href="/account"
                  role="menuitem"
                  className="flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                >
                  <SettingsIcon className="h-4 w-4 text-slate-500" />
                  Account settings
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={signOut}
                  className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-slate-700 hover:bg-red-50 hover:text-red-700"
                >
                  <LogOutIcon className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Mobile topbar */}
        <header className="sticky top-0 z-20 flex h-14 flex-shrink-0 items-center gap-2.5 border-b border-slate-200 bg-white pl-4 pr-2 md:hidden">
          <Link href="/" aria-label="Command Center home" className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[7px] bg-blue-600 text-white">
            <CommandIcon className="h-4 w-4" />
          </Link>
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-900">{sectionTitle}</span>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search"
            className="flex h-11 w-11 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100"
          >
            <SearchIcon className="h-5 w-5" />
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={() => setQuickOpen(true)}
              aria-label="Quick add"
              className="mr-1 flex h-9 w-9 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              <PlusIcon className="h-[18px] w-[18px]" />
            </button>
          )}
        </header>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 pb-16 md:pb-0">{children}</div>
      </div>

      {/* Modals */}
      <CommandPalette
        open={paletteOpen}
        setOpen={setPaletteOpen}
        onQuickAdd={isOwner ? () => setQuickOpen(true) : undefined}
      />
      {isOwner && <QuickAdd open={quickOpen} setOpen={setQuickOpen} />}

      {/* Mobile "More" sheet */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
          onClick={() => setMoreOpen(false)}
          role="presentation"
        >
          <div
            className="absolute inset-x-0 bottom-16 flex max-h-[75vh] flex-col gap-3 overflow-y-auto rounded-t-2xl bg-white px-4 pb-4 pt-2 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="More navigation options"
          >
            <div className="mx-auto mb-1 h-1 w-9 rounded-full bg-slate-300" aria-hidden="true" />
            {isOwner && (
              <button
                type="button"
                onClick={() => { setMoreOpen(false); setQuickOpen(true); }}
                className="flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white"
              >
                <PlusIcon className="h-[18px] w-[18px]" />
                Quick add
              </button>
            )}
            <div className="pt-1 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">All pages</div>
            <div className="grid grid-cols-2 gap-1.5">
              {MORE.map((item) => {
                const Icon = ICON_FOR[item.href] ?? FileTextIcon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-11 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors ${
                      active ? "bg-blue-50 font-semibold text-blue-700" : "bg-slate-50 font-medium text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${active ? "text-blue-600" : "text-slate-500"}`} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <button
              type="button"
              onClick={signOut}
              className="flex h-11 items-center gap-2.5 border-t border-slate-200 px-3 pt-1 text-left text-sm font-medium text-red-700"
            >
              <LogOutIcon className="h-[18px] w-[18px]" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-5 border-t border-slate-200 bg-white md:hidden"
      >
        {MOBILE.map((item) => {
          const Icon = ICON_FOR[item.href] ?? HomeIcon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] ${
                active ? "font-semibold text-blue-700" : "font-medium text-slate-500"
              }`}
            >
              {active && <span className="absolute inset-x-[22%] top-0 h-0.5 rounded-b bg-blue-600" aria-hidden="true" />}
              <Icon className={`h-[22px] w-[22px] ${active ? "text-blue-600" : ""}`} />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] ${
            moreOpen || MORE.some((m) => isActive(m.href)) ? "font-semibold text-blue-700" : "font-medium text-slate-500"
          }`}
        >
          {(moreOpen || MORE.some((m) => isActive(m.href))) && (
            <span className="absolute inset-x-[22%] top-0 h-0.5 rounded-b bg-blue-600" aria-hidden="true" />
          )}
          <MoreHorizontalIcon className={`h-[22px] w-[22px] ${moreOpen || MORE.some((m) => isActive(m.href)) ? "text-blue-600" : ""}`} />
          More
        </button>
      </nav>
    </div>
  );
}

export default NavShell;
