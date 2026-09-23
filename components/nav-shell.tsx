"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandPalette } from "./command-palette";
import { QuickAdd } from "./quick-add";
import { createClient } from "@/lib/supabase/client";

const PRIMARY = [
  { href: "/", label: "Dashboard" },
  { href: "/today", label: "Today" },
  { href: "/timeline", label: "Timeline" },
  { href: "/wins", label: "Wins" },
];
const WORK = [
  { href: "/schools", label: "Schools" },
  { href: "/compare", label: "Compare" },
  { href: "/outreach", label: "Outreach" },
  { href: "/tasks", label: "Tasks" },
  { href: "/research", label: "Research" },
  { href: "/links", label: "Library" },
  { href: "/people", label: "People" },
];
const MOBILE = [
  { href: "/", label: "Home" },
  { href: "/today", label: "Today" },
  { href: "/schools", label: "Schools" },
  { href: "/tasks", label: "Tasks" },
];
const MORE = [
  { href: "/compare", label: "Compare schools" },
  { href: "/outreach", label: "Outreach" },
  { href: "/timeline", label: "Timeline" },
  { href: "/wins", label: "Wins" },
  { href: "/research", label: "Research" },
  { href: "/links", label: "Library" },
  { href: "/people", label: "People" },
  { href: "/account", label: "Account" },
];

function NavHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-400 px-3 pt-5 pb-1.5 first:pt-1 select-none pointer-events-none"
    >
      {children}
    </div>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`block px-3 py-1.5 rounded text-sm border-l-2 ${active ? "bg-surface-raised text-cream font-medium border-brass" : "border-transparent text-gray-500 hover:text-cream hover:bg-surface-raised"}`}
    >
      {label}
    </Link>
  );
}

export function NavShell({ children, isOwner }: { children: React.ReactNode; isOwner: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => setMoreOpen(false), [pathname]);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex w-52 flex-shrink-0 border-r flex-col gap-4 p-4">
        <div className="font-serif text-xl italic">Command Center</div>
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex items-center justify-between text-left border border-line bg-surface-raised rounded px-3 py-1.5 text-xs text-gray-500 hover:border-brass"
        >
          <span>Search or jump to…</span>
          <kbd className="text-[10px] border border-line rounded px-1">Ctrl K</kbd>
        </button>
        {isOwner && (
          <button
            onClick={() => setQuickOpen(true)}
            className="flex items-center justify-between text-left bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm"
          >
            <span>+ Quick add</span>
            <kbd className="text-[10px] border border-ink/30 rounded px-1">Ctrl J</kbd>
          </button>
        )}
        <nav className="flex flex-col gap-0.5">
          <NavHeading>Overview</NavHeading>
          {PRIMARY.map((item) => <NavLink key={item.href} {...item} active={isActive(item.href)} />)}
          <NavHeading>Work</NavHeading>
          {WORK.map((item) => <NavLink key={item.href} {...item} active={isActive(item.href)} />)}
        </nav>
        <div className="mt-auto flex flex-col gap-0.5 border-t border-line pt-3">
          <NavLink href="/account" label="Account" active={isActive("/account")} />
          <button
            onClick={async () => {
              await createClient().auth.signOut();
              window.location.href = "/login";
            }}
            className="text-left px-3 py-2 rounded text-sm text-gray-500 hover:text-cream"
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 min-w-0 pb-16 md:pb-0">{children}</div>
      <CommandPalette open={paletteOpen} setOpen={setPaletteOpen} />
      {isOwner && <QuickAdd open={quickOpen} setOpen={setQuickOpen} />}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute bottom-14 left-3 right-3 bg-surface-raised border border-line rounded-lg p-2 flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {isOwner && (
              <button
                onClick={() => { setMoreOpen(false); setQuickOpen(true); }}
                className="text-left px-3 py-3 rounded text-sm bg-brass text-ink font-medium mb-1"
              >
                + Quick add
              </button>
            )}
            <button
              onClick={() => { setMoreOpen(false); setPaletteOpen(true); }}
              className="text-left px-3 py-3 rounded text-sm text-gray-500 border border-line mb-1"
            >
              Search or jump to…
            </button>
            {MORE.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-3 rounded text-sm ${isActive(item.href) ? "text-brass font-medium" : "text-cream"}`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={async () => {
                await createClient().auth.signOut();
                window.location.href = "/login";
              }}
              className="text-left px-3 py-3 rounded text-sm text-gray-500 border-t border-line mt-1"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-line flex justify-around items-stretch">
        {MOBILE.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 text-center text-xs py-3.5 ${isActive(item.href) ? "text-brass font-medium" : "text-gray-400"}`}
          >
            {item.label}
          </Link>
        ))}
        <button
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          className={`flex-1 text-center text-xs py-3.5 ${moreOpen || MORE.some((m) => isActive(m.href)) ? "text-brass font-medium" : "text-gray-400"}`}
        >
          More
        </button>
      </nav>
    </div>
  );
}
