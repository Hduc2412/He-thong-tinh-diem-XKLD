import { useAuth } from "@/app/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mapCustomerStatus } from "@/lib/formatters";

export function CustomersPage({ items }) {
  const { customerItems } = useAuth();
  const rows = items || customerItems;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Khach hang</CardTitle>
          <CardDescription>Theo doi thi truong, tien do va diem du kien</CardDescription>
        </div>
        <Button>+ Them khach hang</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Khach hang</TableHead>
              <TableHead>Thi truong</TableHead>
              <TableHead>CTV phu trach</TableHead>
              <TableHead>Trang thai</TableHead>
              <TableHead>Diem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item) => (
              <TableRow key={item._id || item.name}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.market}</TableCell>
                <TableCell>{typeof item.owner === "string" ? item.owner : item.owner?.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{mapCustomerStatus(item.status || item.stage)}</Badge>
                </TableCell>
                <TableCell>{item.points || 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
