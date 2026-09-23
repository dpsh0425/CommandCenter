"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandPalette } from "./command-palette";
import { createClient } from "@/lib/supabase/client";

const PRIMARY = [
  { href: "/", label: "Dashboard" },
  { href: "/today", label: "Today" },
  { href: "/timeline", label: "Timeline" },
  { href: "/wins", label: "Wins" },
];
const WORK = [
  { href: "/schools", label: "Schools" },
  { href: "/tasks", label: "Tasks" },
  { href: "/research", label: "Research" },
  { href: "/people", label: "People" },
];
const MOBILE = [
  { href: "/", label: "Home" },
  { href: "/schools", label: "Schools" },
  { href: "/tasks", label: "Tasks" },
  { href: "/research", label: "Research" },
  { href: "/people", label: "People" },
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

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const [paletteOpen, setPaletteOpen] = useState(false);

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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t flex justify-around items-center py-2">
        {MOBILE.map((item) => (
          <Link key={item.href} href={item.href} className={`text-xs px-2 ${isActive(item.href) ? "text-brass font-medium" : "text-gray-400"}`}>
            {item.label}
          </Link>
        ))}
        <button onClick={() => setPaletteOpen(true)} className="text-xs px-2 text-gray-400" aria-label="Search">
          Search
        </button>
      </nav>
    </div>
  );
}
