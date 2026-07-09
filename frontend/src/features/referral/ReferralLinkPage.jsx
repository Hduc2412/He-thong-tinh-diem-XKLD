import { useState } from "react";
import { ClipboardCopy, Send } from "lucide-react";
import { useAuth } from "@/app/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomersPage } from "@/features/customers/CustomersPage";

export function ReferralLinkPage() {
  const { customerItems } = useAuth();
  const [copied, setCopied] = useState(false);
  const referralLink = "https://xkld-points.vn/ref/CTV-001";

  const copyReferralLink = async () => {
    await navigator.clipboard?.writeText(referralLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle>Link gioi thieu ca nhan</CardTitle>
          <CardDescription>CTV dung link nay de gan khach hang vao dung nguon gioi thieu</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="break-all rounded-md border bg-muted/60 p-3 font-mono text-sm">{referralLink}</div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={copyReferralLink}>
              <ClipboardCopy className="h-4 w-4" />
              {copied ? "Da copy" : "Copy link"}
            </Button>
            <Button variant="outline">
              <Send className="h-4 w-4" />
              Gui cho khach
            </Button>
          </div>
        </CardContent>
      </Card>
      <CustomersPage items={customerItems} />
    </div>
  );
}
