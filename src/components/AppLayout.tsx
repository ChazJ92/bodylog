import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Home, ClipboardList, Ruler, BarChart3, Image, Settings as SettingsIcon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Today", icon: Home, end: true },
  { to: "/measurements", label: "Measurements", icon: Ruler },
  { to: "/analysis", label: "Analysis", icon: BarChart3 },
  { to: "/photos", label: "Photos", icon: Image },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function AppLayout() {
  const location = useLocation();
  const onCheckIn = location.pathname.startsWith("/checkin");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="text-2xl font-medium tracking-tight">Ledger</span>
            <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              local · private
            </span>
          </Link>
          <Link
            to="/checkin"
            className={cn(
              "inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm text-background font-sans transition-opacity hover:opacity-90",
              onCheckIn && "opacity-50 pointer-events-none",
            )}
          >
            <Plus className="h-4 w-4" />
            <span>New check-in</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-32 pt-6">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-3xl items-stretch justify-around px-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-1 px-2 py-2.5 text-[10px] uppercase tracking-[0.15em] font-sans",
                    isActive ? "text-accent" : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                <Icon className="h-5 w-5" strokeWidth={1.5} />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
