import { SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pointPrograms } from "@/data/mockData";

export function PointProgramsPage() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        {pointPrograms.map((program) => (
          <Card key={program.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{program.name}</CardTitle>
                  <CardDescription className="mt-1">{program.trigger}</CardDescription>
                </div>
                <Badge variant={program.active ? "success" : "secondary"}>{program.active ? "Dang bat" : "Tat"}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-muted p-3">
                  <p className="text-muted-foreground">Diem</p>
                  <p className="mt-1 text-xl font-semibold">+{program.point}</p>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-muted-foreground">Thuong</p>
                  <p className="mt-1 font-semibold">{program.reward}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <span className="text-muted-foreground">{program.approval}</span>
                <Button variant="outline" size="sm">
                  <SlidersHorizontal className="h-4 w-4" />
                  Cau hinh
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
