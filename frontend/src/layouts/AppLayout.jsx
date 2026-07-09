import { Bell, Menu, ShieldCheck } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/AuthContext";
import { getRouteTitle, navItems } from "@/app/navigation";
import { cn } from "@/lib/utils";

function Sidebar({ open, setOpen }) {
  const { role } = useAuth();
  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 border-r bg-card px-4 py-5 transition-transform lg:static lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex items-center gap-3 px-2">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold">XKLD Points</p>
          <p className="text-xs text-muted-foreground">Tinh diem CTV</p>
        </div>
      </div>
      <nav className="mt-7 space-y-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                isActive && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

function Header({ onMenu }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Mo menu">
            <Menu className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">He thong tinh diem CTV</h1>
            <p className="hidden text-sm text-muted-foreground sm:block">Quan ly diem, KPI va luong theo mang luoi gioi thieu</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Thong bao">
            <Bell className="h-4 w-4" />
          </Button>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>Dang xuat</Button>
        </div>
      </div>
    </header>
  );
}

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const { role, loadError } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-muted/35 text-foreground">
      <div className="lg:flex">
        <Sidebar open={open} setOpen={setOpen} />
        {open && <button className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-label="Dong menu" />}
        <div className="min-w-0 flex-1">
          <Header onMenu={() => setOpen(true)} />
          <main className="mx-auto max-w-7xl p-4 sm:p-6">
            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-medium text-primary">{role}</p>
                <h2 className="text-2xl font-semibold tracking-normal">{getRouteTitle(location.pathname)}</h2>
              </div>
              <Badge variant="secondary">API backend http://127.0.0.1:4100/api</Badge>
            </div>
            {loadError && <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{loadError}</p>}
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
