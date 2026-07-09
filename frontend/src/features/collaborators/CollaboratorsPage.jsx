import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { collaborators } from "@/data/mockData";
import { statusVariant } from "@/lib/formatters";

export function CollaboratorsPage() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Danh sach CTV</CardTitle>
          <CardDescription>Quan ly cap bac, diem va trang thai hoat dong</CardDescription>
        </div>
        <Button>+ Tao CTV</Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex max-w-sm items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Tim theo ten hoac ma CTV" />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ma</TableHead>
              <TableHead>Ho ten</TableHead>
              <TableHead>Cap bac</TableHead>
              <TableHead>Khach hang</TableHead>
              <TableHead>Diem</TableHead>
              <TableHead>Trang thai</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {collaborators.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.id}</TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.level}</TableCell>
                <TableCell>{item.customers}</TableCell>
                <TableCell>{item.points.toLocaleString("vi-VN")}</TableCell>
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
