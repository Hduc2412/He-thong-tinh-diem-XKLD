import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CircleDollarSign, Star, Users, UserRound } from "lucide-react";
import { useAuth } from "@/app/AuthContext";
import { StatCard } from "@/components/common/StatCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { performanceData, pointRequests } from "@/data/mockData";
import { formatMoney, statusVariant } from "@/lib/formatters";

export function DashboardPage() {
  const { role, dashboardData } = useAuth();
  const stats = dashboardData || {};

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Tong CTV" value={role === "Admin" ? stats.ctvCount ?? 0 : 1} note="Du lieu tu backend" icon={Users} tone="bg-primary/10 text-primary" />
        <StatCard title="Khach hang" value={stats.customerCount ?? 0} note="Dang luu trong MongoDB" icon={UserRound} tone="bg-sky-100 text-sky-700" />
        <StatCard title="Diem thang" value={formatMoney(stats.totalPoints)} note={stats.month || "Thang hien tai"} icon={Star} tone="bg-warning/20 text-amber-700" />
        <StatCard title="Luong/KPI" value={`${formatMoney(stats.estimatedSalary)} VND`} note="Tam tinh theo diem" icon={CircleDollarSign} tone="bg-success/15 text-success" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Hieu suat 6 thang</CardTitle>
            <CardDescription>Diem va KPI luong theo thang</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="points" name="Diem" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>De nghi dang cho</CardTitle>
            <CardDescription>Can xac nhan de cong diem</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pointRequests.map((item) => (
              <div key={item.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{item.customer}</p>
                  <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span>{item.ctv}</span>
                  <span className="font-semibold">+{item.point} diem</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
