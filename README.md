# 📸 Smart Attendance System

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?logo=postgresql&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socketdotio&logoColor=white)
![Vercel Ready](https://img.shields.io/badge/Vercel-Ready-black?logo=vercel&logoColor=white)
![Migrations](https://img.shields.io/badge/Migrations-Auto%20on%20Boot-blue)

A full-stack **QR-based attendance management system** for universities, built with **React (Vite)**, **Express 5**, **Socket.IO**, and **PostgreSQL**. It supports two fraud-resistant attendance flows — dynamic **Session QR codes** (JWT, rotated every 5s) and **Personal QR codes** (TOTP, rotated every 30s) — plus live dashboards, analytics, and role-based access for Deans, Heads, Doctors, and Students.

> 🌐 This README includes an [Arabic quick-start section](#مقدمة-سريعة-بالعربي) at the end.

## 📑 Table of Contents

1. [Features](#-features)
2. [Architecture](#-architecture)
3. [Tech Stack](#-tech-stack)
4. [Project Structure](#-project-structure)
5. [Quick Start (Local)](#-quick-start-local)
6. [Environment Variables](#️-environment-variables-reference)
7. [API Overview](#-api-overview)
8. [Deployment](#️-deployment)
9. [Security Notes](#-security-notes)
10. [Troubleshooting](#-troubleshooting-from-real-debugging-sessions)
11. [Author](#-author)
12. [القسم بالعربي](#مقدمة-سريعة-بالعربي)

---

## ✨ Features

### Attendance Flows
- **🔐 Session QR code** — the doctor opens a session and displays a JWT-signed QR code that **regenerates every 5 seconds**; students scan it and attendance is instantly recorded. Expired codes are rejected.
- **🛡️ Personal QR code (TOTP)** — every student has a permanent personal QR containing a **TOTP one-time code (30-second rotation)** verified server-side with `speakeasy`. The same code can be scanned by the **doctor from a laptop, or by another student's phone**, preventing sharing/replay.
- **✍️ Manual override** — doctors can mark attendance manually (auditable, method `manual`).

### Fraud Prevention
- 🧬 **Device fingerprint binding** — students' session-QR attendance is locked to their registered device.
- ⏱️ **TOTP anti-replay** — personal QR codes become invalid after ~30 seconds (±1 window).
- 📌 **Session PINs** for manual verification.
- 📜 **Audit logs** of sensitive actions.

### Role Dashboards
| Role | Capabilities |
|---|---|
| **President (Dean)** | University-wide analytics, attendance overview, high-risk students, staff activity, audit logs, invitations |
| **Head of Department** | Major overview, staff performance, student risk reports, pending invites |
| **Doctor** | Start/end sessions, generate rotating QR, live attendance list, manual marking, personal-QR scanning, course reports & CSV export |
| **Student** | Dashboard, courses, personal QR, scan session QR, attendance history, warnings |
| **Engineer (Monitor)** | Live session monitoring with real-time updates |

### Real-Time & UX
- ⚡ **Socket.IO live updates** — the doctor's attendance list updates in **real time** during local/self-hosted runs.
- 🔄 **Polling fallback (5s)** — on serverless hosts (e.g., Vercel) sockets are disabled and the app automatically polls attendance, so live behavior is preserved anywhere.
- 📱 **Rear-camera QR scanning** (`facingMode: environment`) so phones scan reliably.
- 🖥️ **HTTPS in dev** (via `@vitejs/plugin-basic-ssl`) — because browsers require secure origins for camera access.
- 🌍 **Arabic/English UI support** with a custom UI kit, error boundaries, and motion primitives.

---

## 🏗️ Architecture

```
┌─────────────────────────── Frontend (Vite + React 19) ───────────────────────────┐
│  Login / Role Dashboards / Personal QR / Scanner / Reports                      │
│  axios client (VITE_API_URL)      socket.io-client (VITE_SOCKET_URL, optional)  │
└───────────────┬──────────────────────────────────────────────────┬──────────────┘
                │ REST /api (JWT auth)                             │ WebSocket (dev/self-host)
┌───────────────▼──────────────────────────────────────────────────▼──────────────┐
│                        Backend (Express 5 + Socket.IO)                          │
│  auth · dean · head · doctor · student · invitations routes                      │
│  ⤷ Session QR  → JWT (type=attendance_qr, 5s rotation)                          │
│  ⤷ Personal QR → JSON {type:'student_personal', otp} → TOTP verify              │
│  ⤷ Attendance insert → method ∈ ('qr_scan','manual')  ✔ constraint-checked      │
│  ⤷ Auto migrations on boot (runMigrations.js)                                   │
└───────────────┬─────────────────────────────────────────────────────────────────┘
                │ SQL
┌───────────────▼─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL (sessions · attendance · students …)              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Deployment modes** (both supported by the same codebase):

| Mode | Frontend | Backend | Database | Notes |
|---|---|---|---|---|
| **Local / LAN** | Vite dev server (`:5173`) | `node src/server.js` (`:5000`) | Local PostgreSQL | Full real-time via Socket.IO |
| **Vercel (serverless)** | Vercel static build | Vercel function (`api/index.js`) | Vercel/Neon Postgres | Sockets auto-disabled → 5s polling |
| **Single-service PaaS** | Served **by the backend** from `Frontend/dist` | One Node service | Managed Postgres (Railway/Render/Neon) | One URL, real-time enabled |

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, React Router 7, Axios, `html5-qrcode`, `qrcode.react`, Socket.IO client |
| Backend | Node.js, Express 5, Socket.IO 4, `pg`, `jsonwebtoken`, `bcryptjs`, `speakeasy`, `qrcode`, `nodemailer` |
| Database | PostgreSQL (+ numbered SQL migrations, auto-applied on boot) |
| Dev tooling | ESLint, Nodemon, `@vitejs/plugin-basic-ssl` |
| Deployment | Vercel (serverless functions + Neon Postgres) or any Node PaaS |

---

## 📁 Project Structure

```
Smart-Attendance-System/
├── Backend/
│   ├── api/index.js              # Vercel serverless entry (same Express app)
│   ├── vercel.json               # Vercel rewrites → /api/index.js
│   └── src/
│       ├── server.js             # HTTP + Socket.IO server (local/PaaS mode)
│       ├── app.js                # Express app (shared by server & serverless)
│       ├── runMigrations.js      # Applies numbered migrations on boot (idempotent)
│       ├── config/               # db pool, socket.io init
│       ├── controllers/          # auth, dean, head, doctor, student, invitations…
│       ├── middleware/           # JWT verify, role guards, errors
│       ├── migrations/           # 001_init.sql → 004_password_resets.sql
│       ├── models/ · seeds/ · utils/ · routes/
└── Frontend/
    ├── vercel.json               # SPA rewrites → index.html
    └── src/
        ├── api/                  # axios client + socket client (env-driven URLs)
        ├── components/           # layout, ui kit (buttons, icons, motion…)
        ├── context/ · pages/     # Login, dashboards, PersonalQR, Scanner, Reports…
        └── styles/ utils/        # global CSS design system, helpers
```

---

## 🚀 Quick Start (Local)

### Prerequisites
- **Node.js ≥ 18** (tested on 22)
- **PostgreSQL ≥ 14** running locally
- Git

### 1) Clone & install

```bash
git clone https://github.com/basmala-mahdi-89/Smart-Attendance-System.git
cd Smart-Attendance-System

# Backend
cd Backend && npm install

# Frontend (in a second terminal)
cd Frontend && npm install
```

### 2) Configure environment

Create **`Backend/.env`**:

```env
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/smart_attendance?sslmode=disable
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=1d
EMAIL_USER=your_smtp_email@example.com
EMAIL_PASS=your_smtp_app_password
FRONTEND_URL=https://localhost:5173
```

> ⚠️ Never commit real credentials. Generate a strong secret with:
> `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

### 3) Create database & run

```bash
# In PostgreSQL, create a database (e.g.) named smart_attendance
# Tables are created automatically on first server boot (idempotent migrations):

cd Backend
npm run dev        # → 🚀 Server running on http://localhost:5000
```

Optionally seed demo data:

```bash
node src/seeds/seed.js
```

### 4) Start the frontend

```bash
cd Frontend
npm run dev        # → Vite serves on http://localhost:5173 and LAN (HTTPS via basic-ssl)
```

- Frontend → Backend traffic goes through the **Vite proxy** (`/api` and `/socket.io` → `127.0.0.1:5000`), so **no extra configuration** is needed locally.
- Open `https://192.168.1.10:5173` from a **phone on the same Wi-Fi** to test mobile scanning. Accept the self-signed certificate warning once (dev-only), and allow camera access.

---

## ⚙️ Environment Variables Reference

### Backend (`Backend/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string. Migrations run automatically against it on boot. |
| `JWT_SECRET` | ✅ | Signs session-QR tokens **and** auth tokens — keep it secret & long. |
| `JWT_EXPIRES_IN` | ✅ | Auth token lifetime (e.g. `1d`). |
| `PORT` | ❌ | Defaults to `5000`. Cloud providers inject their own. |
| `EMAIL_USER` / `EMAIL_PASS` | ❌ | SMTP account for email verification & password resets. |
| `FRONTEND_URL` | ❌ | Allowed frontend origin (links in emails). |

### Frontend (build-time, e.g. Vercel dashboard)

| Variable | Purpose |
|---|---|
| *(unset)* | Local dev — axios uses `/api` (Vite proxy) and socket uses same origin. |
| `VITE_API_URL` | Production REST base, **must end with `/api`** (e.g. `https://api.example.com/api`). |
| `VITE_SOCKET_URL` | WebSocket origin — only on hosts that support persistent sockets. |
| `VITE_ENABLE_SOCKET` | Set `false` on serverless hosts (Vercel) to switch to 5-second polling. |

---

## 🔌 API Overview

Base URL: **`/api`** (auth via `Authorization: Bearer <token>`)

| Group | Key endpoints |
|---|---|
| `/api/auth` | `POST /register`, `POST /login`, `GET /me`, email verification & password reset flows |
| `/api/students` | `GET /me`, `GET /me/courses`, `GET /me/attendance`, `GET /me/personal-qr`, **`POST /scan`** (dual-mode: `qr_token` = session QR, `qr_data` = personal QR) |
| `/api/doctor` | sessions CRUD, `GET /sessions/:id/qr` (rotating JWT QR), `GET /sessions/:id/attendance-list`, `POST /sessions/:id/scan-student-qr` (personal QR from doctor's phone), manual marking, reports, CSV export |
| `/api/dean` | university analytics, attendance overview, risk students, audit logs |
| `/api/head` | major statistics, staff performance, student management |
| `/api/invitations` | staff account invitation flow (`GET /:token` for accept-page) |
| `GET /` | Health check → `{"message":"Smart Attendance System API is running 🚀"}` |

### QR Payload Formats
- **Session QR** (doctor screen): a **JWT** `{ type: "attendance_qr", session_id, course_id }` — valid for one rotation (~5s).
- **Personal QR** (student profile): raw **JSON text**
  ```json
  { "type": "student_personal", "student_id": 123, "otp": "123456" }
  ```
  — verified against the student's `totp_secret` (±1 window of 30s). Duplicates are rejected per session.

---

## ☁️ Deployment

### Option A — All-in on Vercel (free, no card)
1. **Sign up** at vercel.com with GitHub.
2. **Storage → Neon Postgres (Free)** → copy the pooled `DATABASE_URL`.
3. **Import repo → Project 1 (Backend)**: Root Directory `Backend`, env vars `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production` → Deploy → health-check the returned URL.
4. **Run migrations once** from your machine:
   ```powershell
   cd Backend
   $env:DATABASE_URL="<your-neon-url>"
   node src/runMigrations.js    # → 🎉 All migrations processed
   ```
5. **Import repo → Project 2 (Frontend)**: Root Directory `Frontend` (Vite auto-detected), env:
   - `VITE_API_URL = https://<backend-project>.vercel.app/api`
   - `VITE_ENABLE_SOCKET = false`
6. Test on phone: real HTTPS → camera works with no certificate drama. Attendance updates refresh every 5 seconds.

> 🐢 Free serverless tiers **sleep** — the first request after ~15 min idle may take a few seconds to wake up. This is normal.

### Option B — Single Node service (keeps real-time WebSockets)
Railway / Render / Fly / a VPS — one service that runs:
```bash
# Build command
npm install --prefix Backend && npm install --prefix Frontend && npm run build --prefix Frontend
# Start command
node Backend/src/server.js
```
The backend automatically serves `Frontend/dist` and falls back to `index.html` for SPA routes — **one URL for the whole app**, with Socket.IO live updates intact.
Environment: `DATABASE_URL` (managed Postgres), `JWT_SECRET`, `NODE_ENV=production`.

---

## 🔒 Security Notes

- Passwords hashed with **bcrypt**; staff accounts are **invitation-only**.
- JWT-protected routes with per-role guards (`dean`, `head`, `doctor`, `student`, `engineer`).
- Session QR freshness enforced by JWT; personal QR freshness by **TOTP windows**.
- Attendance `method` is constrained in SQL to `'qr_scan' | 'manual'` — invalid values are rejected by the database, not just the app.
- Device fingerprint comparison prevents marking attendance from someone else's device.

---

## 🧪 Troubleshooting (from real debugging sessions)

| Symptom | Cause & Fix |
|---|---|
| `EADDRINUSE :5000` in terminal | A backend instance is already running. Close it (`taskkill /F /IM node.exe`) and start **once**. Not a code bug. |
| Camera doesn't open on phone | Must be **HTTPS** (Vercel URL works out of the box; local dev uses basic-ssl). Scanners force the **rear camera** (`facingMode: 'environment'`). |
| `violates check constraint "attendance_method_check"` | Insert uses `method='qr'` somewhere — always use `'qr_scan'`. |
| "Invalid or expired QR", but it should be valid | Session QR rotated (~5s); personal QR rotated (~30s) — re-scan the fresh code. |
| `too many connections` on Neon | Use the **pooled** connection string (host contains `-pooler`). |
| Live list not updating instantly on Vercel | Expected: sockets are off on serverless; updates arrive via 5s polling. |
| Frontend shows "Network Error" after deploy | `VITE_API_URL` must end with `/api`; redeploy after changing env vars. |

---

## 📜 License

Educational project — built as a university graduation system. All rights reserved to the author. 🔐

---

# مقدمة سريعة بالعربي

## التشغيل المحلي

```bash
# 1) نفّذ التثبيت في المجلدين
cd Backend && npm install
cd ../Frontend && npm install

# 2) اعمل ملف Backend/.env بالقيم بتاعتك ( زي القالب اللي فوق )
# 3) شغّل الباك إند
cd Backend && npm run dev          # بورت 5000 + الجداول بتتعمل أوتوماتيك

# 4) شغّل الفرونت إند في ترمنال تاني
cd Frontend && npm run dev         # بورت 5173 مع HTTPS للكاميرا
```

- من الموبايل (نفس الواي فاي): `https://192.168.1.10:5173`
- انتبه: `EADDRINUSE` معناها إن السيرفر شغال بالفعل — قفله وابدأ مرة واحدة.

## أهم 3 قواعد
1. **الكود بتاع جلسة الدكتور** يتغير كل ~5 ثواني لوحده — ده طبيعي وأمان.
2. **الـ QR الشخصي للطالب** يتغير كل ~30 ثانية (TOTP) — يمنع التمثيل والانتحال.
3. على **Vercel** التحديث بيتجدد كل 5 ثواني (Polling) بدل اللحظي — لأن مزود الأكواد مش بتسمح بالـ WebSocket الدائم.

## النشر على Vercel (مجاني)
1. `vercel.com` → تسجيل بـ GitHub.
2. **Storage → Neon Postgres (مجاني)** → احفظ `DATABASE_URL`.
3. مشروع 1: مجلد جذر `Backend` + متغيرات `DATABASE_URL / JWT_SECRET / NODE_ENV=production`.
4. من جهازك مرة واحدة: `$env:DATABASE_URL="…"; node src/runMigrations.js`
5. مشروع 2: مجلد جذر `Frontend` + `VITE_API_URL = رابط-الباك/api` + `VITE_ENABLE_SOCKET=false`.
6. افتح الرابط من الموبايل — HTTPS حقيقي والكاميرا تشتغل على طول 🎉

---

## 👩‍💻 Author

**Basmala Mahdi** — graduation project.
- GitHub: [@basmala-mahdi-89](https://github.com/basmala-mahdi-89)
- Repo: [Smart-Attendance-System](https://github.com/basmala-mahdi-89/Smart-Attendance-System)
