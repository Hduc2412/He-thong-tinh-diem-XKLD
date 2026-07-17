import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { canAccessRoute } from "./navigation";
import { AppLayout } from "@/layouts/AppLayout";
import { LoginPage } from "@/features/auth/LoginPage";
import { ActivityPage } from "@/features/activity/ActivityPage";
import { CollaboratorsPage } from "@/features/collaborators/CollaboratorsPage";
import { CustomersPage } from "@/features/customers/CustomersPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { KpiPage } from "@/features/kpi/KpiPage";
import { PointRequestsPage } from "@/features/points/PointRequestsPage";
import { PointProgramsPage } from "@/features/programs/PointProgramsPage";
import { PointHistoryPage } from "@/features/history/PointHistoryPage";
import { PayrollPage } from "@/features/payroll/PayrollPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { ReferralLinkPage } from "@/features/referral/ReferralLinkPage";
import { RiskPage } from "@/features/risk/RiskPage";
import { TreePage } from "@/features/tree/TreePage";

function ProtectedRoute() {
  const { session, role, checkingSession } = useAuth();
  const location = useLocation();

  if (checkingSession) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Đang kiểm tra phiên đăng nhập...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessRoute(location.pathname, role)) {
    return <Navigate to="/" replace />;
  }

  return <AppLayout />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route index element={<DashboardPage />} />
        <Route path="/programs" element={<PointProgramsPage />} />
        <Route path="/collaborators" element={<CollaboratorsPage />} />
        <Route path="/tree" element={<TreePage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/referral-link" element={<ReferralLinkPage />} />
        <Route path="/point-requests" element={<PointRequestsPage />} />
        <Route path="/point-history" element={<PointHistoryPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/risk" element={<RiskPage />} />
        <Route path="/performance" element={<KpiPage />} />
        <Route path="/payroll" element={<PayrollPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
