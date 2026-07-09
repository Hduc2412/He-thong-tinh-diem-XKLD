import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const kpiItems = [
  { title: "KPI thang", value: "9,120 diem", note: "Dat 86% muc tieu", variant: "warning" },
  { title: "Luong tam tinh", value: "276,000,000 VND", note: "Cho chot cuoi thang", variant: "success" },
  { title: "Ty le xac nhan", value: "92%", note: "18 de nghi dang cho", variant: "default" },
];

export function KpiPage() {
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      {kpiItems.map((item) => (
        <Card key={item.title}>
          <CardHeader>
            <CardTitle>{item.title}</CardTitle>
            <CardDescription>{item.note}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-3">
            <p className="text-2xl font-semibold">{item.value}</p>
            <Badge variant={item.variant}>Thang nay</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
