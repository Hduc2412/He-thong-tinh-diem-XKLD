# He thong tinh diem CTV Xuat khau lao dong

Prototype frontend cho he thong quan ly cong tac vien (CTV), khach hang, diem thuong, KPI va luong trong nghiep vu xuat khau lao dong.

## Cong cu va cong nghe

- React 18
- Vite 6
- Tailwind CSS
- Component UI theo phong cach shadcn/ui
- Lucide React cho icon
- Recharts cho bieu do dashboard
- JavaScript ES Modules
- npm cho quan ly thu vien

## Cau truc du an

```text
He-thong-tinh-diem-XKLD-frontend/
├─ README.md
├─ .gitignore
└─ frontend/
   ├─ index.html
   ├─ package.json
   ├─ vite.config.js
   ├─ tailwind.config.js
   ├─ postcss.config.js
   ├─ jsconfig.json
   ├─ FRONTEND_NOTES.md
   └─ src/
      ├─ main.jsx
      ├─ App.jsx
      ├─ index.css
      ├─ data/
      │  └─ mockData.js
      ├─ lib/
      │  └─ utils.js
      └─ components/
         └─ ui/
            ├─ badge.jsx
            ├─ button.jsx
            ├─ card.jsx
            ├─ input.jsx
            └─ table.jsx
```

## Vai tro cac file chinh

- `frontend/src/main.jsx`: diem khoi dong React, render `App`.
- `frontend/src/App.jsx`: man hinh chinh, sidebar, header, dashboard, cac bang quan ly va logic chuyen vai tro Admin/CTV.
- `frontend/src/data/mockData.js`: du lieu mau cho CTV, khach hang, de nghi cong diem, chuong trinh diem, nhat ky hoat dong, canh bao rui ro va cay gioi thieu.
- `frontend/src/components/ui`: cac component dung lai nhu Button, Card, Table, Input va Badge.
- `frontend/src/index.css`: bien mau, style nen, font va cau hinh Tailwind base.
- `frontend/FRONTEND_NOTES.md`: ghi chu anh xa bai toan CTV XKLD tu cac mo hinh referral/affiliate.

## Luong chay frontend

```text
npm run dev
-> Vite doc vite.config.js
-> index.html nap src/main.jsx
-> main.jsx render App.jsx
-> App.jsx lay du lieu tu mockData.js
-> Hien thi cac man hinh theo role Admin hoac CTV
```

## Luong nghiep vu Admin

```text
Dang nhap / vao dashboard
-> Xem tong CTV, khach hang, diem thang va luong tam tinh
-> Quan ly danh sach CTV
-> Xem so do cay gioi thieu
-> Theo doi khach hang theo CTV phu trach
-> Tao hoac xu ly de nghi cong diem
-> Duyet / tu choi diem
-> Xem nhat ky hoat dong va canh bao rui ro
-> Tong hop hieu suat, KPI va luong thang
```

## Luong nghiep vu CTV

```text
Vao dashboard ca nhan
-> Xem khach hang cua minh
-> Lay link gioi thieu ca nhan
-> Theo doi trang thai de nghi cong diem
-> Xem lich su diem
-> Xem hieu suat va luong/KPI ca nhan
```

## Co che cong diem du kien

Theo tai lieu nghiep vu, diem khong phat sinh ngay khi khach hang dang ky. Diem duoc ghi nhan sau khi khach hang phong van thanh cong va Admin tao ma xac nhan.

```text
CTV tao khach hang
-> Khach hang dang ky
-> Ho so duoc luu voi trang thai REGISTERED
-> Khach hang phong van
-> Admin kiem tra ket qua
-> Admin gui ma xac nhan
-> CTV nhap ma
-> He thong xac thuc ma
-> Sinh giao dich cong diem
-> CTV truc tiep nhan diem
-> CTV cap tren nhan diem chia se
-> Tong hop thang
-> Tinh luong/KPI
```

Moi ma xac nhan chi duoc dung mot lan. Tat ca giao dich cong diem can luu lich su de doi soat va chong gian lan.

## Phan quyen man hinh hien tai

Admin co the xem:

- Dashboard
- Chuong trinh diem
- Quan ly CTV
- So do cay
- Khach hang
- De nghi cong diem
- Hoat dong
- Canh bao rui ro
- Lich su diem
- Hieu suat
- Luong/KPI
- Cai dat

CTV co the xem:

- Dashboard
- Khach hang
- Link gioi thieu
- De nghi cong diem
- Lich su diem
- Hieu suat
- Luong/KPI

## Cai dat va chay du an

Yeu cau:

- Node.js
- npm

Chay frontend:

```bash
cd frontend
npm install
npm run dev
```

Mac dinh Vite chay tai:

```text
http://127.0.0.1:5173
```

Build ban production:

```bash
cd frontend
npm run build
```

Xem thu ban build:

```bash
cd frontend
npm run preview
```

## Trang thai hien tai

- Day la prototype frontend chay doc lap voi du lieu mau.
- Chua co backend va chua co API that.
- Cac thao tac duyet/tu choi diem dang duoc xu ly bang state cuc bo trong React.
- Khi co backend, co the tach API theo cac nhom: CTV, Customer, Point Program, Point Request, Activity, Risk Signal va Payroll.

## Huong phat trien tiep theo

- Them dang nhap va phan quyen that.
- Noi API backend.
- Them form tao CTV, tao khach hang va tao de nghi cong diem.
- Them validate form.
- Luu lich su giao dich diem.
- Xuat bao cao KPI/luong theo thang.
