import {
  BarChart3,
  Clock3,
  FileCheck2,
  Gift,
  LayoutDashboard,
  Link2,
  Network,
  Settings,
  ShieldAlert,
  Star,
  Users,
  UserRound,
  WalletCards,
} from "lucide-react";

export const navItems = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard, roles: ["Admin", "CTV"] },
  { label: "Chuong trinh diem", path: "/programs", icon: Gift, roles: ["Admin"] },
  { label: "Quan ly CTV", path: "/collaborators", icon: Users, roles: ["Admin"] },
  { label: "So do cay", path: "/tree", icon: Network, roles: ["Admin"] },
  { label: "Khach hang", path: "/customers", icon: UserRound, roles: ["Admin", "CTV"] },
  { label: "Link gioi thieu", path: "/referral-link", icon: Link2, roles: ["CTV"] },
  { label: "De nghi cong diem", path: "/point-requests", icon: Star, roles: ["Admin", "CTV"] },
  { label: "Hoat dong", path: "/activity", icon: FileCheck2, roles: ["Admin"] },
  { label: "Canh bao rui ro", path: "/risk", icon: ShieldAlert, roles: ["Admin"] },
  { label: "Lich su diem", path: "/point-history", icon: Clock3, roles: ["Admin", "CTV"] },
  { label: "Hieu suat", path: "/performance", icon: BarChart3, roles: ["Admin", "CTV"] },
  { label: "Luong/KPI", path: "/payroll", icon: WalletCards, roles: ["Admin", "CTV"] },
  { label: "Cai dat", path: "/settings", icon: Settings, roles: ["Admin"] },
];

export function getRouteTitle(pathname) {
  return navItems.find((item) => item.path === pathname)?.label || "Dashboard";
}

export function canAccessRoute(pathname, role) {
  const item = navItems.find((entry) => entry.path === pathname);
  return !item || item.roles.includes(role);
}
