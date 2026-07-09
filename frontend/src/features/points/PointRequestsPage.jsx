import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/app/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { pointRequests } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { formatMoney, statusVariant } from "@/lib/formatters";

export function PointRequestsPage() {
  const { pointItems } = useAuth();
  const [requests, setRequests] = useState(pointRequests);
  const rows = pointItems?.length ? pointItems : requests;

  const updateStatus = (id, status) => {
    setRequests((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>De nghi cong diem</CardTitle>
          <CardDescription>Tao, xac nhan va theo doi trang thai cong diem</CardDescription>
        </div>
        <Button>
          <CheckCircle2 className="h-4 w-4" />
          Tao de nghi
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ma</TableHead>
              <TableHead>CTV</TableHead>
              <TableHead>Khach hang</TableHead>
              <TableHead>Ly do</TableHead>
              <TableHead>Diem</TableHead>
              <TableHead>Thuong</TableHead>
              <TableHead>Trang thai</TableHead>
              <TableHead className="text-right">Xu ly</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item) => (
              <TableRow key={item._id || item.id || item.pointCode?.code}>
                <TableCell className="font-medium">{item.id || item.pointCode?.code}</TableCell>
                <TableCell>{item.ctv || item.beneficiary?.name}</TableCell>
                <TableCell>{item.customer?.name || item.customer}</TableCell>
                <TableCell>{item.reason || item.note}</TableCell>
                <TableCell>+{item.point || item.points}</TableCell>
                <TableCell>{formatMoney(item.salary || (item.points || 0) * 10000)} VND</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(item.status || "Da duyet")}>{item.status || "Da duyet"}</Badge>
                </TableCell>
                <TableCell>
                  <div className={cn("flex justify-end gap-2", pointItems?.length && "hidden")}>
                    <Button variant="outline" size="sm" onClick={() => updateStatus(item.id, "Da duyet")}>
                      Duyet
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => updateStatus(item.id, "Tu choi")}>
                      Tu choi
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
