import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { activityEvents } from "@/data/mockData";
import { statusVariant } from "@/lib/formatters";

export function ActivityPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nhat ky hoat dong</CardTitle>
        <CardDescription>Theo doi thao tac tao khach, xac nhan, duyet diem va canh bao</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gio</TableHead>
              <TableHead>Nguoi thuc hien</TableHead>
              <TableHead>Su kien</TableHead>
              <TableHead>Doi tuong</TableHead>
              <TableHead>Trang thai</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activityEvents.map((item) => (
              <TableRow key={`${item.time}-${item.object}`}>
                <TableCell className="font-medium">{item.time}</TableCell>
                <TableCell>{item.actor}</TableCell>
                <TableCell>{item.event}</TableCell>
                <TableCell>{item.object}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
