import { forwardRef } from "react";
import Link from "next/link";
import { ChevronDownIcon } from "@/components/icons";

// Shared layout pieces. The goal is calm pages: one clear title, plain sections separated by
// whitespace and a thin divider, and borders only on things you can click.

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Small all-caps label above the title, e.g. "APPLICATIONS". Optional. */
  eyebrow?: string;
}) {
  return (
    <header className="flex items-end justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{eyebrow}</p>
        )}
        <h1 className="text-2xl font-semibold leading-8 tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm leading-5 text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-baseline gap-3 min-w-0">
          <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
          {hint && <span className="text-xs text-slate-500 truncate">{hint}</span>}
        </div>
        {action && <div className="text-xs text-slate-600 flex-shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

// A collapsed section: the summary line carries the count so nothing important is hidden.
export function Fold({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group border-b border-slate-200 pb-2">
      <summary className="flex items-center justify-between gap-3 cursor-pointer list-none rounded-md py-1 [&::-webkit-details-marker]:hidden">
        <span className="flex items-baseline gap-3 min-w-0">
          <span className="text-[15px] font-semibold text-slate-900">{title}</span>
          {summary && <span className="text-xs text-slate-500 truncate">{summary}</span>}
        </span>
        <span className="flex items-center gap-1 text-xs font-medium text-slate-500 group-hover:text-slate-900">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
          <ChevronDownIcon className="h-4 w-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}

export function Meta({
  items,
}: {
  items: Array<React.ReactNode | null | false | undefined>;
}) {
  const shown = items.filter(Boolean);
  return (
    <p className="text-sm text-slate-600 flex flex-wrap gap-x-2">
      {shown.map((item, i) => (
        <span key={i} className="flex gap-2">
          {i > 0 && <span aria-hidden className="text-slate-300">·</span>}
          {item}
        </span>
      ))}
    </p>
  );
}

// Sibling pages that belong together (e.g. Today / This week / Timeline) share one tab row.
export function SubNav({
  items,
  current,
}: {
  items: Array<{ href: string; label: string }>;
  current: string;
}) {
  return (
    <nav
      className="flex gap-6 border-b border-slate-200 -mb-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Section"
    >
      {items.map((it) => {
        const isActive = current === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={isActive ? "page" : undefined}
            className={`pb-2.5 text-sm border-b-2 transition-colors -mb-px whitespace-nowrap ${
              isActive
                ? "border-blue-600 text-slate-900 font-semibold"
                : "border-transparent text-slate-500 font-medium hover:text-slate-900"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

export const TODAY_TABS = [
  { href: "/today", label: "Today" },
  { href: "/week", label: "This week" },
  { href: "/actions-list", label: "Actions" },
  { href: "/timeline", label: "Timeline" },
  { href: "/wins", label: "Wins" },
];
export const SCHOOL_TABS = [
  { href: "/schools", label: "All schools" },
  { href: "/compare", label: "Compare" },
  { href: "/readiness", label: "Readiness" },
];
export const MATERIALS_TABS = [
  { href: "/materials", label: "Documents" },
  { href: "/materials/resume", label: "Resume builder" },
  { href: "/materials/statements", label: "Statements" },
  { href: "/materials/letters", label: "Letters" },
];
export const RESEARCH_TABS = [
  { href: "/research", label: "Projects" },
  { href: "/links", label: "Library" },
];

/* ───────────────────────── Primitives for the redesigned pages ───────────────────────── */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 text-white font-semibold hover:bg-blue-700",
  secondary: "border border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50",
  ghost: "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
  danger: "border border-red-300 bg-white text-red-700 hover:bg-red-600 hover:border-red-600 hover:text-white",
};
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-3.5 text-sm",
};

/** Class string for anything that should look like a button (also use it on <Link>). */
export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra = "") {
  return `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${extra}`.trim();
}

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(function Button({ variant = "secondary", size = "md", className = "", type = "button", ...rest }, ref) {
  return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...rest} />;
});

export function Card({
  title,
  actions,
  children,
  className = "",
  padded = true,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </div>
  );
}

export type BadgeTone = "neutral" | "info" | "success" | "danger" | "violet";
const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  info: "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
  danger: "bg-red-50 text-red-700",
  violet: "bg-violet-50 text-violet-700",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export const inputClass =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-600";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = "", ...rest },
  ref,
) {
  return <input ref={ref} className={`${inputClass} ${className}`} {...rest} />;
});
