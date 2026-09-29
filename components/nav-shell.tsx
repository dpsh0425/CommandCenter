"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandPalette } from "./command-palette";
import { QuickAdd } from "./quick-add";
import { createClient } from "@/lib/supabase/client";

const PRIMARY = [
  { href: "/", label: "Home" },
  { href: "/today", label: "Today", also: ["/week", "/timeline", "/wins"] },
];

const WORK = [
  { href: "/schools", label: "Schools", also: ["/compare", "/readiness"] },
  { href: "/outreach", label: "Outreach" },
  { href: "/materials", label: "Materials" },
  { href: "/tasks", label: "Tasks" },
  { href: "/research", label: "Research", also: ["/links"] },
  { href: "/people", label: "People" },
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

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`block px-3 py-2 rounded-lg text-xs font-medium transition-all ${
        active
          ? "bg-slate-100/80 text-blue-600 font-semibold border-l-2 border-blue-600 pl-2.5"
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );
}

export function Sidebar({ children, isOwner }: { children: React.ReactNode; isOwner: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string, also: string[] = []) =>
    href === "/" ? pathname === "/" : [href, ...also].some((h) => pathname.startsWith(h));

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      
      {/* Desktop Light Sidebar */}
      <aside className="hidden md:flex w-64 flex-shrink-0 bg-white border-r border-slate-200/80 sticky top-0 h-screen flex-col justify-between p-4 z-30">
        <div className="space-y-4">
          
          {/* Brand Block matching Login Logo */}
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm">
              C
            </div>
            <span className="font-extrabold text-sm tracking-tight text-slate-900">
              COMMAND<span className="text-blue-600">CENTER</span>
            </span>
          </div>

          {/* Search Input Button */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="w-full flex items-center justify-between text-left bg-slate-50 border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 rounded-lg px-3 py-2 text-xs text-slate-400 hover:border-slate-400 hover:bg-white transition-all shadow-sm"
          >
            <span>Search or jump to…</span>
            <kbd className="text-[10px] font-mono bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-400">
              ⌘K
            </kbd>
          </button>

          {/* Quick Add Button */}
          {isOwner && (
            <button
              onClick={() => setQuickOpen(true)}
              className="w-full flex items-center justify-between bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-3 py-2 text-xs transition-all shadow-sm"
            >
              <span>+ Quick add</span>
              <kbd className="text-[10px] font-mono bg-blue-700/60 border border-blue-500/40 rounded px-1.5 py-0.5 text-white">
                ⌘J
              </kbd>
            </button>
          )}

          {/* Primary & Work Navigation */}
          <nav className="space-y-1 pt-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 block mb-1">
              Main
            </span>
            {PRIMARY.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={isActive(item.href, (item as any).also)}
              />
            ))}

            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 block pt-4 mb-1">
              Workspace
            </span>
            {WORK.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={isActive(item.href, (item as any).also)}
              />
            ))}
          </nav>
        </div>

        {/* Footer Account & Sign Out */}
        <div className="border-t border-slate-100 pt-3 space-y-1">
          <NavLink href="/account" label="Account Settings" active={isActive("/account")} />
          <button
            onClick={async () => {
              await createClient().auth.signOut();
              window.location.href = "/login";
            }}
            className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile Header Bar (< md) */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold text-xs">
            C
          </div>
          <span className="font-extrabold text-xs tracking-tight text-slate-900">
            COMMAND<span className="text-blue-600">CENTER</span>
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-xs font-semibold"
        >
          {mobileMenuOpen ? "Close" : "Menu"}
        </button>
      </div>

      {/* Main Content Area Wrapper */}
      <div className="flex-1 min-w-0 pt-14 md:pt-0 pb-16 md:pb-0">{children}</div>

      {/* Command Palette & Quick Add Modals */}
      <CommandPalette open={paletteOpen} setOpen={setPaletteOpen} />
      {isOwner && <QuickAdd open={quickOpen} setOpen={setQuickOpen} />}

      {/* Mobile Expanded Drawer */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-xs" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute bottom-16 left-3 right-3 bg-white border border-slate-200 rounded-xl p-3 flex flex-col shadow-xl space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            {isOwner && (
              <button
                onClick={() => { setMoreOpen(false); setQuickOpen(true); }}
                className="text-left px-3 py-2.5 rounded-lg text-xs bg-blue-600 text-white font-semibold mb-1"
              >
                + Quick add
              </button>
            )}
            {MORE.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-lg text-xs font-medium ${
                  isActive(item.href) ? "bg-slate-100 text-blue-600 font-semibold" : "text-slate-700"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={async () => {
                await createClient().auth.signOut();
                window.location.href = "/login";
              }}
              className="text-left px-3 py-2 rounded-lg text-xs font-medium text-rose-600 border-t border-slate-100 mt-1"
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 flex justify-around items-stretch shadow-lg">
        {MOBILE.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 text-center text-[11px] py-3.5 font-medium ${
              isActive(item.href) ? "text-blue-600 font-semibold border-t-2 border-blue-600" : "text-slate-500"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <button
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          className={`flex-1 text-center text-[11px] py-3.5 font-medium ${
            moreOpen || MORE.some((m) => isActive(m.href)) ? "text-blue-600 font-semibold border-t-2 border-blue-600" : "text-slate-500"
          }`}
        >
          More
        </button>
      </nav>

    </div>
  );
}

export default Sidebar;