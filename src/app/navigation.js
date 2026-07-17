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
  { label: "Chương trình điểm", path: "/programs", icon: Gift, roles: ["Admin"] },
  { label: "Quản lý CTV", path: "/collaborators", icon: Users, roles: ["Admin"] },
  { label: "Sơ đồ cây", path: "/tree", icon: Network, roles: ["Admin"] },
  { label: "Khách hàng", path: "/customers", icon: UserRound, roles: ["Admin", "CTV"] },
  { label: "Liên kết giới thiệu", path: "/referral-link", icon: Link2, roles: ["CTV"] },
  { label: "Đề nghị cộng điểm", path: "/point-requests", icon: Star, roles: ["Admin", "CTV"] },
  { label: "Hoạt động", path: "/activity", icon: FileCheck2, roles: ["Admin"] },
  { label: "Cảnh báo rủi ro", path: "/risk", icon: ShieldAlert, roles: ["Admin"] },
  { label: "Lịch sử điểm", path: "/point-history", icon: Clock3, roles: ["Admin", "CTV"] },
  { label: "Hiệu suất", path: "/performance", icon: BarChart3, roles: ["Admin", "CTV"] },
  { label: "Lương/KPI", path: "/payroll", icon: WalletCards, roles: ["Admin", "CTV"] },
  { label: "Cài đặt", path: "/settings", icon: Settings, roles: ["Admin"] },
];

export function getRouteTitle(pathname) {
  return navItems.find((item) => item.path === pathname)?.label || "Tổng quan";
}

export function canAccessRoute(pathname, role) {
  const item = navItems.find((entry) => entry.path === pathname);
  return !item || item.roles.includes(role);
}
