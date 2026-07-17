import { Star, UserRound, WalletCards } from "lucide-react";
import { useAuth } from "@/app/AuthContext";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/formatters";

export function DashboardPage() {
  const { dashboardData } = useAuth();
  const stats = dashboardData || {};

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Tổng điểm" value={formatMoney(stats.totalPoints || 0)} note="Dữ liệu từ sổ điểm" icon={Star} tone="bg-primary/10 text-primary" />
        <StatCard title="Ví cá nhân (F)" value={formatMoney(stats.fPoints || 0)} note="Điểm tích lũy" icon={WalletCards} tone="bg-sky-100 text-sky-700" />
        <StatCard title="Ví duy trì (G)" value={formatMoney(stats.gPoints || 0)} note="Điểm duy trì theo tháng" icon={WalletCards} tone="bg-warning/20 text-amber-700" />
        <StatCard title="Đơn hàng" value={stats.customerCount || 0} note="Dữ liệu từ Cloudflare D1" icon={UserRound} tone="bg-success/15 text-success" />
      </div>
      <Card>
        <CardHeader><CardTitle>Trạng thái đổi điểm</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {stats.redemptionUnlocked ? "Tài khoản đã đủ điều kiện đổi điểm." : "Tài khoản chưa đủ điều kiện đổi điểm."}
        </CardContent>
      </Card>
    </div>
  );
}
