import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ApiUnavailableState({ title, description }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Chưa có dữ liệu. Màn hình đã sẵn sàng để nhập dữ liệu hoặc kết nối API sau.
      </CardContent>
    </Card>
  );
}
