# ระบบขอเลื่อนกำหนดตรวจสอบอุปกรณ์ (Equipment Inspection Deferral)

API (NestJS + TypeORM + PostgreSQL) และหน้าเว็บ (React + Vite) สำหรับยื่น อนุมัติ และปฏิเสธคำขอเลื่อนกำหนดตรวจสอบอุปกรณ์ ตามนโยบายหมวด 4.2

การตีความนโยบายและเหตุผลการออกแบบอยู่ใน [DECISIONS.docx](DECISIONS.docx)

## สิ่งที่ต้องมี

- Node.js 20 ขึ้นไป
- Docker (สำหรับ PostgreSQL)

## วิธีรัน

### 1. ฐานข้อมูล

```bash
docker compose up -d
```

PostgreSQL 16 จะขึ้นที่ `localhost:5432` และรัน `seed.sql` ให้อัตโนมัติในครั้งแรก (สร้างตาราง `app_user`, `equipment` พร้อมข้อมูลตัวอย่าง)

> ถ้าเครื่องมี PostgreSQL ตัวอื่นใช้ port 5432 อยู่แล้ว ให้เปลี่ยน port ฝั่งเครื่อง แล้วตั้ง `DATABASE_URL` ของ backend ให้ตรงกัน
>
> ```bash
> DB_PORT=5433 docker compose up -d
> ```

### 2. Backend (port 3000)

```bash
cd backend
npm ci
npm run start:dev
```

ตอนเริ่ม backend จะรัน TypeORM migration ให้อัตโนมัติ (สร้างตาราง `deferral_request` และเพิ่มคอลัมน์ `equipment.cycle_original_due_date`)

ตัวแปร environment (มีค่าเริ่มต้นทุกตัว ไม่ต้องตั้งถ้าใช้ docker compose ตามค่าเดิม)

| ตัวแปร | ค่าเริ่มต้น |
|---|---|
| `DATABASE_URL` | `postgresql://appuser:devpassword@localhost:5432/inspection` |
| `PORT` | `3000` |
| `APP_TIMEZONE` | `Asia/Bangkok` (ใช้คำนวณ "วันนี้") |

### 3. Frontend (port 5173)

```bash
cd frontend
npm ci
npm run dev
```

เปิด http://localhost:5173 แล้วเลือกผู้ใช้จาก dropdown มุมขวาบน

Vite ส่งต่อ `/api` ไปที่ `http://localhost:3000` ถ้า backend อยู่ port อื่น ให้ตั้ง `API_URL` เช่น `API_URL=http://localhost:3100 npm run dev`

## การสร้าง schema

1. `seed.sql` สร้างตารางที่มีอยู่แล้วในระบบ (`app_user`, `equipment`) ผ่าน docker compose
2. TypeORM migration ใน `backend/src/database/migrations/` สร้างส่วนที่เพิ่ม รันอัตโนมัติตอน backend เริ่ม หรือสั่งเองได้

```bash
cd backend
npm run migration:run      # รัน migration
npm run migration:revert   # ย้อน migration ล่าสุด
```

ล้างข้อมูลกลับไปเป็นค่าเริ่มต้น: `docker compose down -v && docker compose up -d`

## Test

```bash
cd backend
npm test                 # unit + integration (ต้องมี PostgreSQL)
npm run test:unit        # เฉพาะ unit test ของนโยบาย 4.2 ไม่ต้องใช้ฐานข้อมูล
npm run test:integration # เฉพาะ integration test
```

- **Unit test** (`src/deferral/deferral-policy.spec.ts`) ทดสอบกฎหมวด 4.2 ทุกกรณีแบบ pure function
- **Integration test** (`test/deferral.e2e-spec.ts`) ยิง HTTP เข้าแอปจริงกับ PostgreSQL จริงจาก `DATABASE_URL` โดยสร้าง schema ชั่วคราว รัน `seed.sql` และ migration ในนั้น แล้วลบทิ้งตอนจบ จึงไม่ยุ่งกับข้อมูล dev

CI (`.github/workflows/ci.yml`) รัน `npm ci → lint → build → test` ของ backend และ `npm ci → lint → build` ของ frontend

## ผู้ใช้ตัวอย่าง (จาก seed.sql)

ไม่มีระบบ login: ทุก request ส่ง header `X-User-Id` แล้ว backend อ่าน role จากตาราง `app_user`

| id | ชื่อ | role |
|---|---|---|
| 1 | Somchai Thongdee | requester |
| 2 | Nattaya Pornsawan | requester |
| 3 | Wichai Kaewsri | supervisor |
| 4 | Pensri Maneerat | supervisor |
| 5 | Anan Siriwat | department_manager |

ทุก role ยื่นคำขอได้ แต่ระบบไม่รับคำขอที่ไม่มีผู้ใช้คนอื่นตัดสินได้ เช่น Anan (ผู้จัดการฝ่ายคนเดียว) ยื่นคำขอที่เกินเงื่อนไขหมวด 4.2 จะได้ 400 เพราะห้ามตัดสินคำขอของตัวเอง

## API

ทุก endpoint อยู่ใต้ `/api` และต้องมี `X-User-Id` ยกเว้น `GET /api/users`

| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/api/users` | รายชื่อผู้ใช้ (ใช้ทำ dropdown) |
| GET | `/api/equipment` | รายการอุปกรณ์ พร้อม id คำขอที่รออนุมัติ (ถ้ามี) |
| POST | `/api/deferral-requests` | ยื่นคำขอ `{ equipmentId, requestedDueDate: "YYYY-MM-DD", reason }` |
| GET | `/api/deferral-requests/pending` | คำขอที่รออนุมัติ พร้อม `canDecide` ของผู้ใช้ปัจจุบัน |
| POST | `/api/deferral-requests/:id/approve` | อนุมัติ `{ note? }` |
| POST | `/api/deferral-requests/:id/reject` | ปฏิเสธ `{ note? }` |

ตัวอย่าง

```bash
curl -X POST http://localhost:3000/api/deferral-requests \
  -H "Content-Type: application/json" -H "X-User-Id: 1" \
  -d '{"equipmentId": 3, "requestedDueDate": "2030-01-31", "reason": "รออะไหล่"}'
```

## โครงสร้าง

```
backend/src/
  deferral/deferral-policy.ts    กฎหมวด 4.2 (pure function)
  deferral/deferral.service.ts   ยื่น / อนุมัติ / ปฏิเสธ (transaction + row lock)
  database/migrations/           migration ของตารางที่เพิ่ม
  auth/current-user.guard.ts     อ่าน X-User-Id
backend/test/                    integration test
frontend/src/pages/              หน้ารายการอุปกรณ์ / ยื่นคำขอ / รออนุมัติ
```
