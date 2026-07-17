import { useState } from "react";
import { ClipboardCopy } from "lucide-react";
import { useAuth } from "@/app/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ReferralLinkPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const referralLink = user?.referralCode ? `${window.location.origin}/register?ref=${encodeURIComponent(user.referralCode)}` : "";

  const copyReferralLink = async () => {
    if (!referralLink) return;
    await navigator.clipboard?.writeText(referralLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Liên kết giới thiệu cá nhân</CardTitle>
        <CardDescription>Liên kết được tạo từ mã giới thiệu của tài khoản đang đăng nhập.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="break-all rounded-md border bg-muted/60 p-3 font-mono text-sm">{referralLink || "Chưa có mã giới thiệu"}</div>
        <Button onClick={copyReferralLink} disabled={!referralLink}>
          <ClipboardCopy className="h-4 w-4" />
          {copied ? "Đã sao chép" : "Sao chép liên kết"}
        </Button>
      </CardContent>
    </Card>
  );
}
