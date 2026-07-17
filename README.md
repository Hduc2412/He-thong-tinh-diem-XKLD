# Frontend hệ thống tính điểm CTV XKLD

Giao diện quản trị và cộng tác viên cho hệ thống điểm thưởng xuất khẩu lao động. Frontend sử dụng API Cloudflare Worker/D1 tại `http://127.0.0.1:8787`.

## Công nghệ

- React 18, React Router 6, Vite 6 và Tailwind CSS
- Lucide React
- npm

## Cài đặt và chạy

```powershell
cd F:\DuAnMoi\frontend
npm.cmd install
npm.cmd run dev
```

Mở `http://127.0.0.1:5173`. Backend phải chạy ở cổng `8787`. Build production bằng `npm.cmd run build`.

Frontend dùng Vite proxy chuyển `/api` sang backend, nhờ đó cookie đăng nhập hoạt động trong môi trường local.

## Cấu trúc

```text
src/
├── app/                 Router, phân quyền, phiên đăng nhập, menu
├── layouts/             Layout chung: sidebar, header và Outlet
├── components/
│   ├── common/          Component nghiệp vụ dùng lại
│   └── ui/              Button, Card, Table, Input, Badge
├── features/            Mỗi chức năng có page riêng
│   ├── auth/            dashboard/       collaborators/
│   ├── customers/       points/          history/
│   ├── referral/        programs/        activity/
│   ├── risk/            tree/            kpi/
│   └── payroll/         settings/
└── lib/                 API client, formatter và tiện ích
```

## Luồng hoạt động

```text
Mở ứng dụng
→ GET /api/auth/me kiểm tra cookie phiên
→ Chưa đăng nhập: chuyển đến /login
→ Đăng nhập thành công: backend đặt httpOnly cookie
→ ProtectedRoute kiểm tra phiên và quyền
→ AppLayout hiển thị menu theo vai trò
→ Outlet hiển thị feature tương ứng
```

Dashboard lấy số dư ví F/G, lịch sử điểm và đơn hàng từ API thật. Chức năng chưa có dữ liệu hiển thị trạng thái trống, không sử dụng mock data.

## Quản lý tài khoản

Trang `/collaborators` dành cho Super Admin, hiển thị trạng thái, lần đăng nhập gần nhất, lần hoạt động gần nhất, số lần đăng nhập và thao tác khóa/mở khóa.

```text
Khóa:   POST /api/admin/users/:id/ban
Mở lại: POST /api/admin/users/:id/unban
```

## Quy ước phát triển

- Mỗi route nghiệp vụ nằm trong một thư mục `features` riêng.
- Component dùng lại đặt trong `components/common` hoặc `components/ui`.
- Request backend khai báo tập trung trong `src/lib/api.js`.
- Không dùng dữ liệu mẫu; dùng API thật hoặc trạng thái rỗng.
