import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { riskSignals } from "@/data/mockData";

export function RiskPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {riskSignals.map((risk) => (
        <Card key={risk.title}>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{risk.title}</CardTitle>
              <Badge variant={risk.level === "Cao" ? "destructive" : risk.level === "Trung binh" ? "warning" : "secondary"}>
                {risk.level}
              </Badge>
            </div>
            <CardDescription>{risk.owner}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{risk.detail}</p>
            <Button className="mt-4 w-full" variant="outline">
              Kiem tra ho so
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
