# Backend he thong tinh diem CTV XKLD

Backend Express + MongoDB cho luong quan ly CTV, khach hang, ma xac nhan, giao dich diem va tong hop KPI/luong.

## Chay local

```bash
cd backend
npm install
copy .env.example .env
npm run seed
npm run dev
```

Server mac dinh chay tai:

```text
http://127.0.0.1:4000/api
```

## Tai khoan seed

```text
Admin: admin@xkld.local / 123456
CTV:   ctv@xkld.local / 123456
```

## Luong chinh

```text
Admin dang nhap
-> Tao/quan ly CTV
-> Tao khach hang
-> Tao ma xac nhan diem sau phong van
-> CTV dang nhap va nhap ma
-> Backend xac thuc ma chua dung
-> Sinh giao dich diem truc tiep va diem cap tren
-> Dashboard/tong hop luong lay tu giao dich diem
```

## API nhom chinh

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/users`
- `POST /api/users`
- `GET /api/customers`
- `POST /api/customers`
- `POST /api/point-codes`
- `POST /api/point-codes/redeem`
- `GET /api/points`
- `GET /api/dashboard`
