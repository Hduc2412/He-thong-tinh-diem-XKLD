import { useAuth } from "@/app/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const statusLabel = { PENDING: "Đang chờ", APPROVED: "Đã duyệt", REJECTED: "Từ chối" };

export function PointRequestsPage() {
  const { orderItems } = useAuth();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Đề nghị cộng điểm</CardTitle>
        <CardDescription>Danh sách đơn hàng lấy trực tiếp từ backend.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Mã đơn</TableHead><TableHead>Người tạo</TableHead><TableHead>Ghi chú</TableHead><TableHead>Trạng thái</TableHead><TableHead>Ngày tạo</TableHead></TableRow></TableHeader>
          <TableBody>
            {orderItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.id}</TableCell><TableCell>{item.userId}</TableCell><TableCell>{item.note || "—"}</TableCell>
                <TableCell><Badge variant="outline">{statusLabel[item.status] || item.status}</Badge></TableCell><TableCell>{new Date(item.createdAt).toLocaleString("vi-VN")}</TableCell>
              </TableRow>
            ))}
            {!orderItems.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Chưa có đề nghị nào.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
