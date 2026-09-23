"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandPalette } from "./command-palette";

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

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`block px-3 py-2 rounded text-sm ${active ? "bg-surface-raised text-cream font-medium border-l-2 border-brass" : "text-gray-500 hover:bg-gray-50"}`}
    >
      {label}
    </Link>
  );
}

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex w-52 flex-shrink-0 border-r flex-col gap-4 p-4">
        <div className="font-serif text-xl italic">Command Center</div>
        <nav className="flex flex-col gap-1">
          {PRIMARY.map((item) => <NavLink key={item.href} {...item} active={isActive(item.href)} />)}
          <div className="text-xs uppercase text-gray-400 px-3 pt-3 pb-1">Work</div>
          {WORK.map((item) => <NavLink key={item.href} {...item} active={isActive(item.href)} />)}
        </nav>
      </aside>
      <div className="flex-1 min-w-0 pb-16 md:pb-0">{children}</div>
      <CommandPalette />
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t flex justify-around py-2">
        {MOBILE.map((item) => (
          <Link key={item.href} href={item.href} className={`text-xs px-2 ${isActive(item.href) ? "text-brass font-medium" : "text-gray-400"}`}>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
