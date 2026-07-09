import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { tree } from "@/data/mockData";

function TreeNode({ node, depth = 0 }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm" style={{ marginLeft: depth * 18 }}>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{node.name}</span>
      </div>
      {node.children?.map((child) => (
        <TreeNode key={child.name} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export function TreePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>So do cay gioi thieu</CardTitle>
        <CardDescription>Hien thi mang luoi CTV theo cap bac</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {tree.map((node) => (
          <TreeNode key={node.name} node={node} />
        ))}
      </CardContent>
    </Card>
  );
}
