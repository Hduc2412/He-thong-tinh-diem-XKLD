import {
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCopy,
  Clock3,
  FileCheck2,
  Gift,
  LayoutDashboard,
  Link2,
  Menu,
  Network,
  Search,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Users,
  UserRound,
  WalletCards,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { activityEvents, collaborators, customers, performanceData, pointPrograms, pointRequests, riskSignals, tree } from "@/data/mockData";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, roles: ["Admin", "CTV"] },
  { label: "Chuong trinh diem", icon: Gift, roles: ["Admin"] },
  { label: "Quan ly CTV", icon: Users, roles: ["Admin"] },
  { label: "So do cay", icon: Network, roles: ["Admin"] },
  { label: "Khach hang", icon: UserRound, roles: ["Admin", "CTV"] },
  { label: "Link gioi thieu", icon: Link2, roles: ["CTV"] },
  { label: "De nghi cong diem", icon: Star, roles: ["Admin", "CTV"] },
  { label: "Hoat dong", icon: FileCheck2, roles: ["Admin"] },
  { label: "Canh bao rui ro", icon: ShieldAlert, roles: ["Admin"] },
  { label: "Lich su diem", icon: Clock3, roles: ["Admin", "CTV"] },
  { label: "Hieu suat", icon: BarChart3, roles: ["Admin", "CTV"] },
  { label: "Luong/KPI", icon: WalletCards, roles: ["Admin", "CTV"] },
  { label: "Cai dat", icon: Settings, roles: ["Admin"] },
];

function statusVariant(status) {
  if (status.includes("Da") || status.includes("Hoat")) return "success";
  if (status.includes("Cho")) return "warning";
  if (status.includes("Tu") || status.includes("Tam")) return "destructive";
  return "secondary";
}

function StatCard({ title, value, note, icon: Icon, tone }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{note}</p>
        </div>
        <div className={cn("grid h-11 w-11 place-items-center rounded-md", tone)}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function mapCustomerStatus(status) {
  const labels = {
    REGISTERED: "Da dang ky",
    INTERVIEW_DONE: "Da phong van",
    PASSED: "Da dat",
    DEPARTED: "Da xuat canh",
  };

  return labels[status] || status;
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("admin@xkld.local");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const session = await api.login({ email, password });
      onLogin(session);
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

function Sidebar({ role, open, setOpen, active, setActive }) {
  const visibleItems = navItems.filter((item) => item.roles.includes(role));
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 border-r bg-card px-4 py-5 transition-transform lg:static lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex items-center gap-3 px-2">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold">XKLD Points</p>
          <p className="text-xs text-muted-foreground">Tinh diem CTV</p>
        </div>
      </div>
      <nav className="mt-7 space-y-1">
        {visibleItems.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              setActive(item.label);
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              active === item.label && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

function Header({ role, setRole, onMenu, user, onLogout }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Mo menu">
            <Menu className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">He thong tinh diem CTV</h1>
            <p className="hidden text-sm text-muted-foreground sm:block">Quan ly diem, KPI va luong theo mang luoi gioi thieu</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Thong bao">
            <Bell className="h-4 w-4" />
          </Button>
          <div className="flex rounded-md border bg-card p-1">
            {["Admin", "CTV"].map((item) => (
              <button
                key={item}
                onClick={() => setRole(item)}
                className={cn("rounded-sm px-3 py-1.5 text-sm font-medium", role === item ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <Button variant="outline" onClick={onLogout}>Dang xuat</Button>
        </div>
      </div>
    </header>
  );
}

function Dashboard({ role, dashboardData }) {
  const stats = dashboardData || {};
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Tong CTV" value={role === "Admin" ? stats.ctvCount ?? 0 : 1} note="Du lieu tu backend" icon={Users} tone="bg-primary/10 text-primary" />
        <StatCard title="Khach hang" value={stats.customerCount ?? 0} note="Dang luu trong MongoDB" icon={UserRound} tone="bg-sky-100 text-sky-700" />
        <StatCard title="Diem thang" value={formatMoney(stats.totalPoints)} note={stats.month || "Thang hien tai"} icon={Star} tone="bg-warning/20 text-amber-700" />
        <StatCard title="Luong/KPI" value={`${formatMoney(stats.estimatedSalary)} VND`} note="Tam tinh theo diem" icon={CircleDollarSign} tone="bg-success/15 text-success" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Hieu suat 6 thang</CardTitle>
            <CardDescription>Diem va KPI luong theo thang</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="points" name="Diem" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>De nghi dang cho</CardTitle>
            <CardDescription>Can xac nhan de cong diem</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pointRequests.map((item) => (
              <div key={item.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{item.customer}</p>
                  <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span>{item.ctv}</span>
                  <span className="font-semibold">+{item.point} diem</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CollaboratorTable() {
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

function CustomerTable({ items = customers }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Khach hang</CardTitle>
          <CardDescription>Theo doi thi truong, tien do va diem du kien</CardDescription>
        </div>
        <Button>+ Them khach hang</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Khach hang</TableHead>
              <TableHead>Thi truong</TableHead>
              <TableHead>CTV phu trach</TableHead>
              <TableHead>Trang thai</TableHead>
              <TableHead>Diem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item._id || item.name}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.market}</TableCell>
                <TableCell>{typeof item.owner === "string" ? item.owner : item.owner?.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{mapCustomerStatus(item.status || item.stage)}</Badge>
                </TableCell>
                <TableCell>{item.points || 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RequestsTable({ pointItems }) {
  const [requests, setRequests] = useState(pointRequests);
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
            {(pointItems?.length ? pointItems : requests).map((item) => (
              <TableRow key={item.id}>
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

function TreeView() {
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

function KpiPanel() {
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      {[
        ["KPI thang", "9,120 diem", "Dat 86% muc tieu", "warning"],
        ["Luong tam tinh", "276,000,000 VND", "Cho chot cuoi thang", "success"],
        ["Ty le xac nhan", "92%", "18 de nghi dang cho", "default"],
      ].map(([title, value, note, variant]) => (
        <Card key={title}>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{note}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <p className="text-2xl font-semibold">{value}</p>
            <Badge variant={variant}>Thang nay</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ProgramCards() {
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

function ReferralLinkPanel({ customerItems }) {
  const referralLink = "https://xkld-points.vn/ref/CTV-001";
  const [copied, setCopied] = useState(false);

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
          <div className="rounded-md border bg-muted/60 p-3 font-mono text-sm">{referralLink}</div>
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
      <CustomerTable items={customerItems} />
    </div>
  );
}

function ActivityTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nhat ky hoat dong</CardTitle>
        <CardDescription>Theo doi thao tac tao khach, xac nhan, duyet diem va canh bao</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gio</TableHead>
              <TableHead>Nguoi thuc hien</TableHead>
              <TableHead>Su kien</TableHead>
              <TableHead>Doi tuong</TableHead>
              <TableHead>Trang thai</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activityEvents.map((item) => (
              <TableRow key={`${item.time}-${item.object}`}>
                <TableCell className="font-medium">{item.time}</TableCell>
                <TableCell>{item.actor}</TableCell>
                <TableCell>{item.event}</TableCell>
                <TableCell>{item.object}</TableCell>
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

function RiskPanel() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {riskSignals.map((risk) => (
        <Card key={risk.title}>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{risk.title}</CardTitle>
              <Badge variant={risk.level === "Cao" ? "destructive" : risk.level === "Trung binh" ? "warning" : "secondary"}>{risk.level}</Badge>
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

function MainContent({ active, role, dashboardData, customerItems, pointItems }) {
  if (active === "Chuong trinh diem") return <ProgramCards />;
  if (active === "Quan ly CTV") return <CollaboratorTable />;
  if (active === "So do cay") return <TreeView />;
  if (active === "Khach hang") return <CustomerTable items={customerItems} />;
  if (active === "Link gioi thieu") return <ReferralLinkPanel customerItems={customerItems} />;
  if (active === "De nghi cong diem" || active === "Lich su diem") return <RequestsTable pointItems={pointItems} />;
  if (active === "Hoat dong") return <ActivityTable />;
  if (active === "Canh bao rui ro") return <RiskPanel />;
  if (active === "Hieu suat" || active === "Luong/KPI") return <KpiPanel />;
  if (active === "Cai dat") return <KpiPanel />;
  return <Dashboard role={role} dashboardData={dashboardData} />;
}

export default function App() {
  const [session, setSession] = useState(() => {
    const stored = localStorage.getItem("xkld-session");
    return stored ? JSON.parse(stored) : null;
  });
  const [role, setRole] = useState(session?.user?.role || "Admin");
  const [active, setActive] = useState("Dashboard");
  const [open, setOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [customerItems, setCustomerItems] = useState(customers);
  const [pointItems, setPointItems] = useState([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!session?.token) return;

    setRole(session.user.role);
    setLoadError("");

    Promise.all([
      api.dashboard(session.token),
      api.customers(session.token),
      api.points(session.token),
    ])
      .then(([dashboardResponse, customersResponse, pointsResponse]) => {
        setDashboardData(dashboardResponse.data);
        setCustomerItems(customersResponse.data);
        setPointItems(pointsResponse.data);
      })
      .catch((error) => setLoadError(error.message));
  }, [session]);

  const handleLogin = (nextSession) => {
    localStorage.setItem("xkld-session", JSON.stringify(nextSession));
    setSession(nextSession);
    setActive("Dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("xkld-session");
    setSession(null);
    setActive("Dashboard");
  };

  if (!session) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const allowed = navItems.some((item) => item.label === active && item.roles.includes(role));
  const visibleActive = allowed ? active : "Dashboard";

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    const nextRoleCanViewActivePage = navItems.find((item) => item.label === active)?.roles.includes(nextRole);
    if (!nextRoleCanViewActivePage) {
      setActive("Dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-muted/35 text-foreground">
      <div className="lg:flex">
        <Sidebar role={role} open={open} setOpen={setOpen} active={visibleActive} setActive={setActive} />
        {open && <button className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-label="Dong menu" />}
        <div className="min-w-0 flex-1">
          <Header
            role={role}
            setRole={handleRoleChange}
            onMenu={() => setOpen(true)}
            user={session.user}
            onLogout={handleLogout}
          />
          <main className="mx-auto max-w-7xl p-4 sm:p-6">
            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-medium text-primary">{role}</p>
                <h2 className="text-2xl font-semibold tracking-normal">{visibleActive}</h2>
              </div>
              <Badge variant="secondary">API backend http://127.0.0.1:4100/api</Badge>
            </div>
            {loadError && <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{loadError}</p>}
            <MainContent active={visibleActive} role={role} dashboardData={dashboardData} customerItems={customerItems} pointItems={pointItems} />
          </main>
        </div>
      </div>
    </div>
  );
}
