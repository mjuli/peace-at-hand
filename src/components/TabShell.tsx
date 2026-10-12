import { Link } from "@tanstack/react-router";
import { Sprout, CalendarDays, Award, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

const tabs = [
  { to: "/jornada", label: "Jornada", icon: Sprout },
  { to: "/historico", label: "Histórico", icon: CalendarDays },
  { to: "/conquistas", label: "Conquistas", icon: Award },
  { to: "/ajustes", label: "Ajustes", icon: SlidersHorizontal },
] as const;

export function TabShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex-1 pb-28">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-md pb-safe">
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {tabs.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex flex-col items-center gap-1 pt-3 pb-1 text-[11px] tracking-wide text-muted-foreground transition-colors duration-500"
                activeProps={{ className: "text-sage" }}
              >
                <Icon className="h-5 w-5" strokeWidth={1.4} />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function SoonScreen({ title }: { title: string }) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-8 text-center animate-fade-slow">
      <h1 className="font-display text-4xl font-light">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">Em breve. Cada coisa a seu tempo.</p>
    </div>
  );
}
