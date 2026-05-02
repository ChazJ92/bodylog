import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Home, Ruler, BarChart3, Image, Settings as SettingsIcon, Plus } from "lucide-react";
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
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src="/icon.png"
              alt=""
              aria-hidden="true"
              className="h-9 w-9 rounded-xl shadow-soft"
            />
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-semibold tracking-tight text-foreground">
                BodyLog
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                local · private
              </span>
            </div>
          </Link>
          <Link
            to="/checkin"
            className={cn(
              "btn-primary",
              onCheckIn && "pointer-events-none opacity-50",
            )}
          >
            <Plus className="h-4 w-4" />
            <span>New check-in</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-32 pt-8">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur"
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
                    "flex flex-col items-center gap-1 px-2 py-2.5 text-[10px] font-medium uppercase tracking-[0.15em] transition-colors",
                    isActive
                      ? "text-brand-dark"
                      : "text-muted-foreground hover:text-brand",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        "h-5 w-5 transition-colors",
                        isActive ? "text-brand" : "text-muted-foreground",
                      )}
                      strokeWidth={isActive ? 2 : 1.6}
                    />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
