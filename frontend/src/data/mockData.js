export const performanceData = [
  { month: "T1", points: 420, salary: 12 },
  { month: "T2", points: 520, salary: 14 },
  { month: "T3", points: 610, salary: 18 },
  { month: "T4", points: 720, salary: 21 },
  { month: "T5", points: 840, salary: 24 },
  { month: "T6", points: 910, salary: 27 },
];

export const collaborators = [
  { id: "CTV-001", name: "Nguyen Minh Anh", level: "Truong nhom", customers: 36, points: 2850, status: "Hoat dong" },
  { id: "CTV-002", name: "Tran Duc Huy", level: "CTV cap 1", customers: 22, points: 1640, status: "Hoat dong" },
  { id: "CTV-003", name: "Le Hoang Vy", level: "CTV cap 2", customers: 14, points: 880, status: "Tam dung" },
  { id: "CTV-004", name: "Pham Quoc Bao", level: "CTV cap 1", customers: 19, points: 1320, status: "Hoat dong" },
];

export const customers = [
  { name: "Do Van Nam", market: "Nhat Ban", owner: "Nguyen Minh Anh", stage: "Da xuat canh", points: 350 },
  { name: "Bui Thi Hoa", market: "Han Quoc", owner: "Tran Duc Huy", stage: "Cho phong van", points: 120 },
  { name: "Hoang Tuan Kiet", market: "Duc", owner: "Nguyen Minh Anh", stage: "Hoan thien ho so", points: 80 },
  { name: "Mai Ngoc Linh", market: "Dai Loan", owner: "Pham Quoc Bao", stage: "Da dong phi", points: 210 },
];

export const pointRequests = [
  { id: "PD-1029", ctv: "Nguyen Minh Anh", customer: "Do Van Nam", reason: "Xuat canh thanh cong", point: 350, salary: 3500000, status: "Cho duyet" },
  { id: "PD-1028", ctv: "Tran Duc Huy", customer: "Bui Thi Hoa", reason: "Dat coc don hang", point: 120, salary: 900000, status: "Da duyet" },
  { id: "PD-1027", ctv: "Pham Quoc Bao", customer: "Mai Ngoc Linh", reason: "Hoan thien ho so", point: 80, salary: 450000, status: "Tu choi" },
];

export const pointPrograms = [
  {
    id: "CTD-01",
    name: "Xuat canh thanh cong",
    trigger: "Khach hang co ngay bay va hop dong hop le",
    point: 350,
    reward: "3,500,000 VND",
    approval: "Admin duyet thu cong",
    active: true,
  },
  {
    id: "CTD-02",
    name: "Dat coc don hang",
    trigger: "Khach hang hoan tat dat coc",
    point: 120,
    reward: "900,000 VND",
    approval: "CTV xac nhan truoc khi duyet",
    active: true,
  },
  {
    id: "CTD-03",
    name: "Hoan thien ho so",
    trigger: "Ho so du dieu kien nop cho doi tac",
    point: 80,
    reward: "450,000 VND",
    approval: "Kiem tra trung khach",
    active: true,
  },
];

export const activityEvents = [
  { time: "09:20", actor: "Admin", event: "Tao de nghi cong diem", object: "Do Van Nam", status: "Cho duyet" },
  { time: "10:05", actor: "Tran Duc Huy", event: "Xac nhan thong tin khach", object: "Bui Thi Hoa", status: "Da duyet" },
  { time: "13:40", actor: "He thong", event: "Phat hien trung so dien thoai", object: "Mai Ngoc Linh", status: "Can kiem tra" },
  { time: "15:10", actor: "Nguyen Minh Anh", event: "Them khach hang moi", object: "Hoang Tuan Kiet", status: "Moi" },
];

export const riskSignals = [
  { level: "Cao", title: "Trung so dien thoai", detail: "2 khach hang dung cung mot so lien he trong 7 ngay", owner: "Pham Quoc Bao" },
  { level: "Trung binh", title: "Diem tang bat thuong", detail: "CTV co diem tang 68% so voi trung binh 3 thang", owner: "Nguyen Minh Anh" },
  { level: "Thap", title: "Ho so thieu minh chung", detail: "1 de nghi dang cho bo sung file xac nhan", owner: "Tran Duc Huy" },
];

export const tree = [
  {
    name: "Admin",
    children: [
      { name: "Nguyen Minh Anh", children: [{ name: "Le Hoang Vy" }, { name: "Tran Bao Chau" }] },
      { name: "Tran Duc Huy", children: [{ name: "Pham Quoc Bao" }] },
    ],
  },
];
