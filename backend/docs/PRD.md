# PRD: Reward Points, Referral Network & Point Redemption System for Labor Export (XKLĐ) Collaborators

**Document type:** Product Requirements Document (PRD) — the complete business document for the application: it describes the entire business logic (referral network, the two-wallet point mechanism, and cash redemption) at the product/functional-requirements level. It does **not** include detailed technical design (full data schema, API, tech stack) — that belongs in a separate tech spec.

**Source of truth:** The business diagram `docs/xkld.png` ("HOW POINTS ARE CALCULATED"). This document is a redesign that follows exactly the model in that diagram, replacing every prior model (the previous "single point wallet, all points come from an Admin-approved Order" model **no longer applies**).

**Content scope:** Three main areas — **referral network/registration**, **point accrual through two wallet types (F & G)**, and **cash redemption**.

---

## 1. Context & Goals

The labor-export (XKLĐ) company operates through a network of collaborators (CTV / Users) who refer one another. A User has three kinds of point-generating activity:
1. **Registering** to join the network (referred by someone else).
2. **Referring new collaborators (CTVs)** into the network.
3. **Referring an actual customer who goes abroad for labor export** — the most valuable business outcome, which happens outside the system and requires Super Admin verification.

Reward points accumulate into **two different wallets** per User: the **F wallet (personal)**, which accrues long-term and is never wiped, and the **G wallet (maintenance)**, which is credited every month but gets reset if the User fails to sustain results (no customer going abroad). Finally, the Super Admin can deduct points to redeem them for cash already paid in the real world (Redemption).

**System goals:**
1. Manage the User network as a **single-level referral** (each User has exactly one direct referrer), letting Users self-register and refer others to join.
2. Automatically credit points for events that need no verification: **registration**, **referring another CTV**, and **monthly maintenance accrual**.
3. Provide a flow where a **User self-creates an Order reporting "the customer has gone abroad" → Super Admin verifies and approves/rejects** to trigger the large reward (for the User + their referrer).
4. Manage the **maintenance wallet (G)** with monthly accrual and a **rolling 3-month reset** when there is no customer going abroad.
5. Let the Super Admin **deduct points** from a User to redeem for cash (Redemption), subject to an unlock condition.
6. Ensure all point movements (both wallets) have a complete, immutable history for reconciliation.

---

## 2. Scope

**In scope (this phase):**
- Registration / single-level referral network (via invite link or by entering a referral code), activated immediately.
- **Two point wallets per User**: the F wallet (personal) and the G wallet (maintenance).
- **Automatic** point accrual when: a User registers, someone the User referred registers, and every month (maintenance).
- **"Customer went abroad" Order**: self-created by the User, approved or rejected by the Super Admin to trigger the large reward.
- The **G wallet reset mechanism** using a rolling 3-month window.
- An immutable Point Ledger; each wallet's balance is always derivable from this ledger.
- Redemption: the Super Admin deducts points (F and/or G wallet) to redeem for cash, subject to the unlock condition.

**Out of scope / for later phases:**
- Any form of point redemption other than cash Redemption performed by the Admin (e.g., a User redeeming points for goods/services themselves).
- Peer-to-peer (P2P) point transfer between two Users — no current need; if it arises later, the point-storage architecture must be reevaluated (see Section 11).
- A list/UI for viewing whom you have referred — the network currently only serves internal point calculation.
- A User canceling/withdrawing an Order after creating it — only the Admin may change an Order's status.
- Dynamic configuration of the point constants (10 / 2 / 50 / 10 / 10-per-month) — these are currently fixed, system-wide constants.

> **Note:** The `life_point` concept from earlier versions **has been removed** — the two wallets F and G in this document are the two fully defined point types, replacing `life_point`.

---

## 3. Referral Network Model

- Each User has **exactly one direct referrer**, except the "root" account created by the Super Admin (which has no referrer).
- The network may be many levels deep, but the business logic **only cares about one level**: when User X earns the "customer went abroad" reward, only X's direct referrer receives the indirect bonus — no further ancestors are traversed.
- **Only two account types exist**: **Super Admin** (exactly one account) and **User** (everyone else).

### Account registration
- Registration must always determine a referrer, via one of two ways:
  1. **Via invite link**: the referrer shares a link; the system automatically assigns the sharer as the referrer.
  2. **By entering a referral code**: the registrant enters the referrer's code (identifier) into the registration form.
- **The account is activated immediately upon registration** — no Admin approval needed.
- **Only the Super Admin can create a "root" account** (with no referrer) — used to bootstrap the initial network.

---

## 4. User Roles

| Role | Description |
|---|---|
| **Super Admin** (1 account) | Creates the "root" account; verifies (outside the system) and approves/rejects "customer went abroad" Orders; performs Redemption (deducting points for cash); views the full point-transaction history for both wallets. |
| **User** (everyone else) | Refers others to join (shares an invite link or their referral code); self-creates an Order to report that "the customer has gone abroad"; views their own Order statuses; views their two wallet balances (F & G) and their own transaction history. |

---

## 5. The Two Point Wallets (Core Concept)

Each User has **two independent point wallets**:

| Wallet | Business name | Nature | Behavior |
|---|---|---|---|
| **F** | Personal wallet (`cá nhân`) | Long-term accumulated points | **Cumulative; never automatically reset to 0.** Only decreases through Redemption. |
| **G** | Maintenance wallet (`duy trì`) | Activity-maintenance points | **+10 every month**; **reset to 0** if the User has no customer going abroad within a rolling 3-month window (see Section 6.4). |

Each wallet's balance is **not stored separately** — it is always derived by summing that User's Point Ledger rows belonging to that wallet.

---

## 6. Detailed Business Flows & Point-Accrual Rules

All numbers below are **fixed, system-wide constants**, not configurable per transaction.

### 6.1. Registration & referral (automatic)
1. A new user registers via an invite link (referrer auto-assigned) or by entering a referral code. The account is activated immediately.
2. **Registration bonus (automatic):** the new User receives **+10 points into their own F wallet** (`REGISTRATION_BONUS`).
3. **CTV referral bonus (automatic):** the new User's direct referrer receives **+2 points into the referrer's F wallet** (`REFERRAL_SIGNUP_BONUS`).
4. Both of the above are granted **immediately upon successful registration**, with no Admin approval.

### 6.2. Monthly maintenance accrual (automatic)
1. Starting from the User's registration time, **every 1 month** the system automatically credits **+10 points into the User's G wallet** (`MAINTENANCE_ACCRUAL`).
2. This accrual is performed by a periodic, system-driven process — no User or Admin action required.
3. The monthly +10 accrual happens **independently** of the reset mechanism in Section 6.4 (when a reset is due, the reset occurs first, then that month's +10 is still added).

### 6.3. "Customer went abroad" Order — creation & approval (requires Admin verification)
This is the **only event requiring Super Admin approval**, because it reflects a real-world result outside the system (an actual customer emigrating for labor).
1. The User refers a customer, and that customer has gone abroad for labor export (outside the system).
2. **The User creates an Order** in the system, tied to themselves, with an optional note/reference. The Order is in `PENDING` status.
3. **The Super Admin verifies (outside the system) and reviews the pending Order.**
4. If valid, the Admin **approves** → the Order moves to `APPROVED`, and the Point Ledger records:
   - **+50 points into the F wallet** of the User who created the Order (`CUSTOMER_REWARD`).
   - If that User has a referrer: **+10 points into the F wallet** of the direct referrer (`CUSTOMER_REFERRAL_BONUS`) — exactly one level.
5. If invalid, the Admin **rejects** → the Order moves to `REJECTED`, and no points are generated.
6. Each Order changes status from `PENDING` **exactly once** (to `APPROVED` or `REJECTED`); only the Super Admin may change the status. A User cannot cancel/edit an Order after creating it.
7. An approved Order is also the **reference event for the G wallet maintenance mechanism** (Section 6.4) and for the **Redemption unlock condition** (Section 6.5).

### 6.4. G wallet (maintenance) reset — rolling 3-month window
Goal: the G wallet keeps its points only if the User continuously sustains results (has customers going abroad). If it goes "cold" too long, the G wallet is wiped.

- **Warm-up phase (first 3 months):** during the first 3 months from registration, the G wallet only accrues +10/month (up to 30 after 3 months); **no reset is applied yet** — there isn't a full 3-month window to evaluate.
- **From month 4 onward (at each monthly accrual):** the system checks the **most recent rolling 3-month window**:
  - If in the last 3 months there is **no** "customer went abroad" Order that was `APPROVED` → **reset the G wallet to 0 first** (`MAINTENANCE_RESET`, a negative row equal to the current G balance), then still add the month's **+10** (`MAINTENANCE_ACCRUAL`). Result: the G wallet for that month = 10.
  - If in the last 3 months there is **at least one** `APPROVED` Order → **no reset**; the G wallet keeps accumulating +10.
- Resetting the G wallet **affects the G wallet only**, not the F wallet.

> **Interpretation note:** The original diagram describes "over 3 months G has 30; if there's no customer, it's wiped to 0." This PRD applies a **rolling** 3-month window (evaluated each month from month 4), with a 3-month warm-up to avoid resetting from the very first month.

### 6.5. Cash Redemption
1. **Unlock condition:** a User may redeem points (withdraw from the F and/or G wallet) only if they **have ever had at least one `APPROVED` "customer went abroad" Order** in their entire history (a permanent unlock — derivable from the existence of at least one `CUSTOMER_REWARD` row for the User).
   - A User who has never had a customer go abroad **cannot** redeem, even if F/G have a balance.
2. The Super Admin has already paid the User cash outside the system (the payout process is out of scope).
3. The Super Admin performs **Redemption**: selects a User, chooses the wallet(s) to deduct (**F and/or G**), enters the number of points to deduct from each, with an optional note.
4. The system deducts points immediately — **no User confirmation needed**. The Point Ledger records a `REDEMPTION` row (negative points) tied to the exact wallet deducted.
5. Redemption **deducts only the exact number of points entered** — it does not auto-zero the wallet; any remaining balance is kept.
6. Redemption is only allowed if the corresponding wallet **has sufficient balance**; otherwise the operation is rejected. No wallet may go negative.
7. The system **does not store the redeemed cash amount** — converting points to money is calculated by the Admin outside the system.
8. The G wallet reset mechanism (Section 6.4) still applies **independently** of the Redemption unlock condition: an unlocked User can still see the G wallet drop to 0 if a cycle passes with no customer going abroad within the 3-month window.

---

## 7. Point Transaction Types — Summary

| Type (`type`) | Trigger event | Wallet | Sign/Points | Who/Level | Admin approval? |
|---|---|---|---|---|---|
| `REGISTRATION_BONUS` | New User registers | F | +10 | The User | No (automatic) |
| `REFERRAL_SIGNUP_BONUS` | A user referred by the User registers | F | +2 | Referrer (1 level) | No (automatic) |
| `MAINTENANCE_ACCRUAL` | Every month since registration | G | +10 | The User | No (automatic, monthly) |
| `MAINTENANCE_RESET` | No customer within the rolling 3-month window | G | −(equal to G balance) | The User | No (automatic) |
| `CUSTOMER_REWARD` | "Customer went abroad" Order `APPROVED` | F | +50 | The User | **Yes** |
| `CUSTOMER_REFERRAL_BONUS` | "Customer went abroad" Order `APPROVED` | F | +10 | Referrer (1 level) | **Yes** |
| `REDEMPTION` | Admin redeems points for cash | F and/or G | −(entered amount) | The User | (Admin performs) |

---

## 8. Business Rules

- Each User has **two independent wallets** (F personal, G maintenance); every point always belongs to exactly one wallet.
- **Automatic points** (`REGISTRATION_BONUS`, `REFERRAL_SIGNUP_BONUS`, `MAINTENANCE_ACCRUAL`) are generated without the Admin.
- **"Customer went abroad" points** (`CUSTOMER_REWARD` +50 / `CUSTOMER_REFERRAL_BONUS` +10) are generated **only** after the Admin approves the Order; the indirect bonus is counted for exactly **one level**, with no upward traversal.
- Each Order changes status from `PENDING` **exactly once** (`APPROVED`/`REJECTED`); only the Super Admin may change it; a User cannot cancel it.
- **The F wallet is cumulative and never automatically reset to 0**; it only decreases through Redemption.
- **The G wallet** accrues +10/month; it is **reset to 0** when the rolling 3-month window (from month 4) has no approved Order; the reset affects the G wallet only.
- **Redemption** is only unlocked once the User **has ever had ≥1 `APPROVED` Order**; it deducts exactly the entered points from the chosen wallet; it requires sufficient balance; no negative balances.
- The Redemption unlock condition and the G wallet reset mechanism are **two independent rules**.
- Every Point Ledger row is **immutable (append-only)** — never edited/deleted; to adjust, create a new row (a reset is a negative row, not a deletion of old rows).
- Each wallet's balance is always recomputed from the source Point Ledger, never stored as a separate "hard" figure.
- The point constants (10 / 2 / 10-per-month / 50 / 10) are system constants, applied uniformly.

---

## 9. Functional Requirements by Role

**Super Admin**
- FR1: Create a "root" account (no referrer) to bootstrap the network.
- FR2: View the list of "customer went abroad" Orders by status (`PENDING`/`APPROVED`/`REJECTED`), filtered by User.
- FR3: Approve a `PENDING` Order → credit +50 (User) / +10 (referrer) into the F wallet.
- FR4: Reject a `PENDING` Order.
- FR5: Perform Redemption — deduct points from a User's F and/or G wallet (checking the unlock condition + sufficient balance), with an optional note.
- FR6: View the entire Point Ledger history (both wallets), filtered by User/time/transaction type/wallet.
- FR7: View the current balances of **both wallets (F & G)** for any User.

**User**
- FR8: Refer others to join (share an invite link or their referral code).
- FR9: Self-create a "customer went abroad" Order to report it, with an optional note.
- FR10: View the status of Orders they created (`PENDING`/`APPROVED`/`REJECTED`).
- FR11: View **their F & G wallet balances** and their transaction history (Point Ledger).

**System (automatic)**
- FR12: When a User registers successfully: record `REGISTRATION_BONUS` (+10 F wallet for the new User) and `REFERRAL_SIGNUP_BONUS` (+2 F wallet for the referrer).
- FR13: Each month for each User: record `MAINTENANCE_ACCRUAL` (+10 G wallet); from month 4, if the rolling 3-month window has no `APPROVED` Order, record `MAINTENANCE_RESET` (bring the G wallet to 0) before adding the month's +10.

---

## 10. Data to Store (Conceptual Level)

At the PRD level, this lists the data needed (not a full technical schema — see the separate tech spec):

- **User**: identifier, full name, role (`SUPER_ADMIN`/`USER`), referrer (nullable), referral code, active status, registration timestamp (the anchor for monthly maintenance), F & G wallet balances (derived from the Point Ledger).
- **Order** ("customer went abroad"): identifier, creating User (= beneficiary User), optional note/reference, status (`PENDING`/`APPROVED`/`REJECTED`), the Super Admin who approved/rejected, created/approved/rejected timestamps.
- **Point Ledger**: identifier, related User, **wallet (`F`/`G`)**, type (`REGISTRATION_BONUS`/`REFERRAL_SIGNUP_BONUS`/`MAINTENANCE_ACCRUAL`/`MAINTENANCE_RESET`/`CUSTOMER_REWARD`/`CUSTOMER_REFERRAL_BONUS`/`REDEMPTION`), points (+/- sign), linked Order (if any), note (if any), created timestamp.

---

## 11. Non-Functional Requirements

- **Access control (RBAC)**: a User sees only their own data; the Super Admin sees everything.
- **Data integrity**: guard against race conditions when the Admin approves/rejects an Order multiple times/concurrently, when the maintenance-accrual/reset process runs redundantly, or when a Redemption is submitted twice — ensuring each Order generates points exactly once, each maintenance period accrues/resets exactly once, and no wallet balance ever goes negative.
- **Idempotency of the monthly process**: maintenance accrual and G wallet reset must be idempotent by (User, month period) so reruns don't double-count.
- **Traceability & reconciliation**: every Order creation, approval, rejection, automatic accrual, reset, and Redemption must have a complete history (who/which process, when).
- **Scale**: under 1,000 Users, low operation frequency; the monthly task runs as a batch over all Users.
- **Point-storage architecture**: at the current scale and flows (no peer-to-peer point transfer between two Users), every point credit/debit on one wallet of one User can be expressed as a single conditional write (compare-and-swap) on one entity — no more complex coordination needed. If a peer-to-peer transfer feature is added later, this point must be reevaluated.

---

## 12. Assumptions Applied in This PRD Version

- The system serves a single labor-export company.
- Single-level referral network; all point constants are fixed (10 registration / 2 CTV referral / 50 customer-abroad for the User / 10 customer-abroad for the referrer / 10 maintenance per month), not configurable per transaction.
- Accounts registered via link/referral code are activated immediately, no Admin approval.
- Only the "customer went abroad" event requires Super Admin approval; registration, CTV referral, and maintenance accrual are automatic.
- The F wallet is cumulative and never wiped; the G wallet resets on a rolling 3-month window, with a 3-month warm-up.
- Redemption is performed directly by the Admin (unlocked once a User has ever had ≥1 customer going abroad), deducts exactly the entered points from the chosen wallet, needs no User confirmation, and does not store the redeemed cash amount.
- The earlier `life_point` concept has been removed, replaced by the two wallets F & G.
