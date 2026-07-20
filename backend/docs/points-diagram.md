# Sơ đồ tính điểm (từ `xkld.png`)

Diễn giải trực quan bản vẽ gốc **"CÁCH TÍNH ĐIỂM"**. Đây là bản Mermaid hoá của `docs/xkld.png`;
luật chi tiết nằm ở [`PRD.md`](./PRD.md), thiết kế kỹ thuật ở [`tech-spec.md`](./tech-spec.md).

## 1. Mạng lưới giới thiệu & 2 ví điểm

Bản vẽ mô tả chuỗi giới thiệu `A → B`, và mỗi CTV có 2 ví: **F (cá nhân)** và **G (duy trì)**.
Node `E` (ví điểm của B) chỉ là cách bản vẽ tách ví F và G của B ra cho dễ nhìn.

```mermaid
flowchart TD
    A["CTV 1 — A"]
    B["CTV 2 — B"]
    D["CTV 3 — D"]
    C["Khách đi XKLĐ — C"]

    A -->|giới thiệu| B
    B -->|giới thiệu CTV| D
    B -->|giới thiệu khách| C

    A --- F1["Ví F1 (cá nhân của A)"]
    A --- G1["Ví G1 (duy trì của A)"]
    B --- F["Ví F (cá nhân của B)"]
    B --- G["Ví G (duy trì của B)"]

    classDef ctv fill:#4a90d9,stroke:#2c5f8a,color:#fff;
    classDef khach fill:#f2d600,stroke:#b8a200,color:#000;
    classDef vif fill:#f5a623,stroke:#b87700,color:#000;
    classDef vig fill:#f5a623,stroke:#b87700,color:#000;
    class A,B,D ctv;
    class C khach;
    class F1,F,vif vif;
    class G1,G vig;
```

## 2. Luật cộng điểm (đúng các gạch đầu dòng trong ảnh)

```mermaid
flowchart LR
    subgraph ViF["Ví F — cá nhân (cộng dồn, không xoá)"]
        r1["B đăng ký: +10 → F(B)"]
        r2["B giới thiệu D: +2 → F(B)"]
        r3["B giới thiệu khách C, Admin duyệt:<br/>+50 → F(B), +10 → F1(A)"]
    end
    subgraph ViG["Ví G — duy trì (theo tháng)"]
        g1["Mỗi 1 tháng kể từ khi B đăng ký: +10 → G(B)"]
        g2["3 tháng đầu: G tối đa 30 điểm (warm-up)"]
        g3["Từ tháng 4, chu kỳ rolling 3 tháng<br/>KHÔNG có khách đi → G reset về 0,<br/>rồi vẫn +10 tháng đó"]
    end
```

## 3. Điều kiện rút tiền (redemption)

```mermaid
flowchart TD
    start["User muốn rút điểm F/G ra tiền"] --> cond{"Đã từng có ≥1 khách<br/>đi XKLĐ được duyệt?"}
    cond -->|Chưa| lock["KHOÁ — không được rút<br/>(dù F/G có điểm)"]
    cond -->|Rồi| unlock["MỞ KHOÁ vĩnh viễn"]
    unlock --> redeem["Admin trừ đúng số điểm nhập<br/>từ ví F và/hoặc G (đủ số dư, không âm)"]
```

## 4. Đối chiếu nguyên văn ảnh → luật

| Câu trong ảnh | Luật hệ thống |
|---|---|
| "Khi B đăng ký thì B được nhận 10 điểm vào ví F" | `REGISTRATION_BONUS` +10 F |
| "B giới thiệu ra D thì B nhận được 2 điểm vào ví F" | `REFERRAL_SIGNUP_BONUS` +2 F |
| "B giới thiệu khách C, B dc 50 điểm vào ví F, A được 10 điểm vào ví F1" | `CUSTOMER_REWARD` +50 F (B) + `CUSTOMER_REFERRAL_BONUS` +10 F (A) — cần Admin duyệt |
| "Từ khi B đăng ký thì cứ sau 1 tháng lại cộng vào ví G 10 điểm" | `MAINTENANCE_ACCRUAL` +10 G / tháng |
| "Trong 3 tháng ví G sẽ có 30 điểm, nếu tháng thứ 4 không có khách C đi thì ví G bị xoá về 0 … theo chu kỳ 3 tháng k giới thiệu sẽ bị cho về 0" | `MAINTENANCE_RESET` (rolling 3 tháng, từ tháng 4) |
| "Điều kiện để được đổi điểm ra tiền … khi B giới thiệu được C thì mới được rút điểm từ ví F và G" | Mở khoá redemption: cần ≥1 order APPROVED |
| "Ví F sẽ luôn được cộng dồn và k bị xoá về 0" | F cộng dồn, chỉ giảm khi `REDEMPTION` |

> **Ghi chú diễn giải:** ảnh gốc nói "qua 3 tháng G có 30; không có khách thì xoá về 0". PRD áp dụng
> **cửa sổ rolling 3 tháng** (đánh giá mỗi tháng từ tháng 4) + warm-up 3 tháng, để không reset ngay
> từ tháng đầu. Xem PRD §6.4.
</content>
</invoke>
