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
import { cn } from "@/lib/utils";
import { useState } from "react";

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

function Header({ role, setRole, onMenu }) {
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
        </div>
      </div>
    </header>
  );
}

function Dashboard({ role }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Tong CTV" value={role === "Admin" ? "128" : "12"} note="+8 trong thang" icon={Users} tone="bg-primary/10 text-primary" />
        <StatCard title="Khach hang" value="1,284" note="326 dang xu ly" icon={UserRound} tone="bg-sky-100 text-sky-700" />
        <StatCard title="Diem thang" value="9,120" note="+14.2% so voi thang truoc" icon={Star} tone="bg-warning/20 text-amber-700" />
        <StatCard title="Luong/KPI" value="276 tr" note="Da tam tinh den hom nay" icon={CircleDollarSign} tone="bg-success/15 text-success" />
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

function CustomerTable() {
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
            {customers.map((item) => (
              <TableRow key={item.name}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.market}</TableCell>
                <TableCell>{item.owner}</TableCell>
                <TableCell>
                  <Badge variant="outline">{item.stage}</Badge>
                </TableCell>
                <TableCell>{item.points}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RequestsTable() {
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
            {requests.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.id}</TableCell>
                <TableCell>{item.ctv}</TableCell>
                <TableCell>{item.customer}</TableCell>
                <TableCell>{item.reason}</TableCell>
                <TableCell>+{item.point}</TableCell>
                <TableCell>{item.salary.toLocaleString("vi-VN")} VND</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
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

function ReferralLinkPanel() {
  const referralLink = "https://xkld-points.vn/ref/CTV-001";
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
            <Button>
              <ClipboardCopy className="h-4 w-4" />
              Copy link
            </Button>
            <Button variant="outline">
              <Send className="h-4 w-4" />
              Gui cho khach
            </Button>
          </div>
        </CardContent>
      </Card>
      <CustomerTable />
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

function MainContent({ active, role }) {
  if (active === "Chuong trinh diem") return <ProgramCards />;
  if (active === "Quan ly CTV") return <CollaboratorTable />;
  if (active === "So do cay") return <TreeView />;
  if (active === "Khach hang") return <CustomerTable />;
  if (active === "Link gioi thieu") return <ReferralLinkPanel />;
  if (active === "De nghi cong diem" || active === "Lich su diem") return <RequestsTable />;
  if (active === "Hoat dong") return <ActivityTable />;
  if (active === "Canh bao rui ro") return <RiskPanel />;
  if (active === "Hieu suat" || active === "Luong/KPI") return <KpiPanel />;
  if (active === "Cai dat") return <KpiPanel />;
  return <Dashboard role={role} />;
}

export default function App() {
  const [role, setRole] = useState("Admin");
  const [active, setActive] = useState("Dashboard");
  const [open, setOpen] = useState(false);

  const allowed = navItems.some((item) => item.label === active && item.roles.includes(role));
  const visibleActive = allowed ? active : "Dashboard";

  return (
    <div className="min-h-screen bg-muted/35 text-foreground">
      <div className="lg:flex">
        <Sidebar role={role} open={open} setOpen={setOpen} active={visibleActive} setActive={setActive} />
        {open && <button className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-label="Dong menu" />}
        <div className="min-w-0 flex-1">
          <Header
            role={role}
            setRole={(nextRole) => {
              setRole(nextRole);
              if (nextRole === "CTV" && !navItems.find((item) => item.label === active)?.roles.includes("CTV")) {
                setActive("Dashboard");
              }
            }}
            onMenu={() => setOpen(true)}
          />
          <main className="mx-auto max-w-7xl p-4 sm:p-6">
            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-medium text-primary">{role}</p>
                <h2 className="text-2xl font-semibold tracking-normal">{visibleActive}</h2>
              </div>
              <Badge variant="secondary">Frontend React JS + Tailwind + shadcn style</Badge>
            </div>
            <MainContent active={visibleActive} role={role} />
          </main>
        </div>
      </div>
    </div>
  );
}
