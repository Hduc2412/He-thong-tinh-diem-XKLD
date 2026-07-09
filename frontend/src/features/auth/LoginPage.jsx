import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export function LoginPage() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@xkld.local");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (session) {
    return <Navigate to="/" replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const nextSession = await api.login({ email, password });
      login(nextSession);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-muted/35 p-4 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Dang nhap he thong</CardTitle>
          <CardDescription>Su dung tai khoan Admin hoac CTV da duoc cap</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">Email</label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="password">Mat khau</label>
              <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <Button className="w-full" disabled={loading}>
              {loading ? "Dang dang nhap..." : "Dang nhap"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
