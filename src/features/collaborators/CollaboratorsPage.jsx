import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function dateLabel(value) {
  return value ? new Date(value).toLocaleString("vi-VN") : "Chưa đăng nhập";
}

export function CollaboratorsPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.adminUsers({ limit: 100 });
      setUsers(response.users || []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const ban = async (user) => {
    if (!window.confirm(`Bạn có chắc muốn khóa tài khoản ${user.fullName}?`)) return;
    try {
      await api.banUser(user.id);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const unban = async (user) => {
    if (!window.confirm(`Bạn có chắc muốn mở khóa tài khoản ${user.fullName}?`)) return;
    try {
      await api.unbanUser(user.id);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quản lý cộng tác viên</CardTitle>
        <CardDescription>Theo dõi trạng thái và hoạt động tài khoản.</CardDescription>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <Table>
          <TableHeader><TableRow><TableHead>Họ tên</TableHead><TableHead>Số điện thoại</TableHead><TableHead>Trạng thái</TableHead><TableHead>Đăng nhập gần nhất</TableHead><TableHead>Hoạt động gần nhất</TableHead><TableHead>Số lần đăng nhập</TableHead><TableHead className="text-right">Thao tác</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải dữ liệu...</TableCell></TableRow>}
            {!loading && users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.fullName}</TableCell>
                <TableCell>{user.phone}</TableCell>
                <TableCell><Badge variant={user.isActive ? "success" : "destructive"}>{user.isActive ? "Đang hoạt động" : "Đã khóa"}</Badge></TableCell>
                <TableCell>{dateLabel(user.lastLoginAt)}</TableCell>
                <TableCell>{dateLabel(user.lastSeenAt)}</TableCell>
                <TableCell>{user.loginCount}</TableCell>
                <TableCell className="text-right">
                  {user.isActive
                    ? <Button variant="destructive" size="sm" onClick={() => ban(user)}>Khóa tài khoản</Button>
                    : <Button variant="outline" size="sm" onClick={() => unban(user)}>Mở khóa</Button>}
                </TableCell>
              </TableRow>
            ))}
            {!loading && !users.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có cộng tác viên.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
