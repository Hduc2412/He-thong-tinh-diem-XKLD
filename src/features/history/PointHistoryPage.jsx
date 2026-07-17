import { useAuth } from "@/app/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function PointHistoryPage() {
  const { pointItems } = useAuth();
  return (
    <Card>
      <CardHeader><CardTitle>Lịch sử điểm</CardTitle><CardDescription>Dữ liệu giao dịch từ sổ điểm backend.</CardDescription></CardHeader>
      <CardContent><Table><TableHeader><TableRow><TableHead>Ví</TableHead><TableHead>Loại giao dịch</TableHead><TableHead>Điểm</TableHead><TableHead>Ghi chú</TableHead><TableHead>Thời gian</TableHead></TableRow></TableHeader>
        <TableBody>{pointItems.map((item) => <TableRow key={item.id}><TableCell>{item.wallet}</TableCell><TableCell>{item.type}</TableCell><TableCell>{item.points > 0 ? "+" : ""}{item.points}</TableCell><TableCell>{item.note || "—"}</TableCell><TableCell>{new Date(item.createdAt).toLocaleString("vi-VN")}</TableCell></TableRow>)}
          {!pointItems.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Chưa có giao dịch điểm nào.</TableCell></TableRow>}
        </TableBody></Table></CardContent>
    </Card>
  );
}
