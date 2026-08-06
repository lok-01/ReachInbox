#  ReachInbox — Full-Stack Email Job Scheduler

A production-grade, highly-resilient, and scalable email scheduling and monitoring service + dashboard. It allows users to schedule cold email campaigns, rotating across multiple SMTP accounts, with per-sender hourly rate limits and real-time logging.

---

## 🛠️ Tech Stack
- **Backend**: Node.js, Express.js, TypeScript, Prisma (ORM), BullMQ, Redis (`ioredis`), Nodemailer
- **Frontend**: React (Vite), TypeScript, Tailwind CSS v4, Axios, `@react-oauth/google`
- **Database**: MySQL, Redis

---

## ⚙️ Environment Configuration

### Backend Env (`backend/.env`)
Create a `.env` file inside the `backend` folder:
```env
# Database Connection
DATABASE_URL="mysql://root@localhost:3306/reachinbox"

# Redis Config
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Server Port
PORT=4000

# BullMQ Config
WORKER_CONCURRENCY=5
MIN_DELAY_MS=2000

# Global Default Hourly Rate Limit (per sender)
MAX_EMAILS_PER_HOUR_PER_SENDER=200

# Google OAuth Credentials
GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
```

### Frontend Env (`frontend/.env`)
Create a `.env` file inside the `frontend` folder:
```env
VITE_GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
VITE_API_BASE="http://localhost:4000/api"
```

---

## 🚀 How to Run the Project

### 1. Run Databases
Ensure **MySQL** (port `3306`) and **Redis** (port `6379`) are running locally.

### 2. Run Backend
```bash
cd backend
npm install
npx prisma db push
npm run dev
```

### 3. Run Frontend
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 📬 How to Set Up Ethereal Email (SMTP Sandbox)
* **Auto-Generation (Recommended)**: In the frontend Compose Modal, click **`+ Add Ethereal Test Sender`**. The backend will automatically generate a new Ethereal test account via Nodemailer APIs in one click, insert it into the database, and select it.
* **Manual Setup**: If you wish to use a specific Ethereal account, register at [ethereal.email](https://ethereal.email), copy your username/password, and insert it via the database or API.
* **Viewing Sent Emails**: Open your backend terminal log. When an email is sent, a preview link like `https://ethereal.email/message/d1a2b3...` is logged. Control+Click the link to view the rendered email.

---

## 📐 Architecture & Core Concepts

### 1. How Scheduling Works
Instead of using slow, polling cron jobs (e.g. searching the database every 10 seconds), this service uses **BullMQ Delayed Jobs**.
* When you submit a campaign, the start time and the throttling offset (delay) are calculated.
* The backend adds jobs directly to the Redis sorted set (`zset`) with a computed `delay` option.
* Redis automatically releases the job to be processed by a worker at the exact millisecond required.

### 2. Persistence & Survival Across Restarts
To ensure no emails are lost if the server crashes or restarts:
* **Prisma MySQL DB** maintains the source of truth for the campaign and job states (`PENDING`, `SENT`, `FAILED`, `RATE_LIMITED`).
* On startup, the backend runs a **Recovery Handler** (`src/recovery.ts`) that checks for any unsent jobs (`PENDING`, `SCHEDULED`, `RATE_LIMITED`) in the database.
* If these jobs are missing from Redis, it instantly re-enqueues them with their original scheduling parameters.
* **Idempotency**: Every database job ID maps to the BullMQ `jobId`. If a job is re-enqueued, BullMQ ignores the duplicate automatically.

### 3. Concurrency & Rate Limiting
* **Worker Concurrency**: Workers process jobs concurrently based on the `WORKER_CONCURRENCY` env variable (default is `5`), enabling scale.
* **Minimum Send Delay**: Emulates real-world provider limits (e.g. minimum 2 seconds between sends) inside the worker logic.
* **Atomic Redis Rate Limiting**:
  - We use an atomic Redis `INCR` key formatted as: `rate_limit:<senderId>:<UTC_hour_window>`.
  - Keys are set with a `7200s` (2-hour) expire buffer.
  - If a sender's counter exceeds the limit, the job status is set to `RATE_LIMITED` in the database, and the job is rescheduled to run at the beginning of the **next hour window** using a computed delay (`msUntilNextHour()`).

---

## 📋 Features Implemented

### Backend
- **Core Scheduler**: Persistent BullMQ + Redis job runner (no cron).
- **Restart Recovery**: Startup scanner that re-enqueues missing tasks.
- **Atomic Rate Limiter**: Shared Redis counter preventing SMTP lockout.
- **Idempotency Protection**: Ensures duplicate sends are rejected.
- **Ethereal Mailer**: Automated Nodemailer mock transport configurations.

### Frontend
- **Google OAuth Login**: Authentic verification rendering name, email, and avatar inside the header.
- **Dynamic Stats Board**: Visual dashboard showing counts of Scheduled, Sent, Failed, and Rate-Limited emails.
- **Staggered Email Composer**: Supports calendar schedules, throttle delays, hourly limits, and dynamic CSV/TXT lead list counters.
- **Logs Table**: Automatic 15-second page refresh table with skeleton screens, status badges, and pagination.

---

## 📝 Assumptions, Shortcuts & Trade-offs
1. **Google OAuth Token Logic**: The backend verifies Google OAuth tokens directly. For full production security, an access/refresh token JWT rotation pattern would be added to keep sessions alive.
2. **SQLite vs. MySQL**: MySQL is used to leverage enterprise indexing and ACID transactional safety for logs.
3. **Ethereal Inbox**: Used as the default fake SMTP sandbox. A real SMTP provider can be used by inserting SMTP host and credentials into the `Sender` table.
4. **CSV Parsing**: The parser extracts all email matches from text files, avoiding formatting rigidity (e.g., handles commas, newlines, tabs automatically).