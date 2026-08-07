#  ReachInbox — Full-Stack Email Job Scheduler

A production-grade, highly-resilient, and scalable email scheduling and monitoring service + dashboard. It allows users to schedule cold email campaigns, rotating across multiple SMTP accounts, with per-sender hourly rate limits and real-time logging.

---

## 🌐 Live Demo

- **Frontend (Vercel)**: [https://reachinboxx-inky.vercel.app/](https://reachinboxx-inky.vercel.app/)
- **Backend (Railway)**: [https://reachinbox-production-534a.up.railway.app](https://reachinbox-production-534a.up.railway.app)

---

##  Tech Stack
- **Backend**: Node.js, Express.js, TypeScript, Prisma (ORM), BullMQ, Redis (`ioredis`), Nodemailer
- **Frontend**: React (Vite), TypeScript, Tailwind CSS v4, Axios, `@react-oauth/google`
- **Database**: MySQL, Redis
- **Deployment**: Vercel (Frontend), Railway (Backend + MySQL + Redis)

---

##  Environment Configuration

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

##  How to Run the Project

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

##  How to Set Up Ethereal Email (SMTP Sandbox)
* **Auto-Generation (Recommended)**: In the frontend Compose Modal, click **`+ Add Sender`**. The backend will automatically generate a new Ethereal test account via Nodemailer APIs in one click, insert it into the database, and select it.
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

## Features Implemented

### Backend
- **Core Scheduler**: Persistent BullMQ + Redis job runner (no cron).
- **Restart Recovery**: Startup scanner that re-enqueues missing tasks.
- **Atomic Rate Limiter**: Shared Redis counter preventing SMTP lockout.
- **Idempotency Protection**: Ensures duplicate sends are rejected.
- **Ethereal Mailer**: Automated Nodemailer mock transport configurations.
- **Single Job Details API**: `GET /api/jobs/:id` endpoint for real-time status polling of individual email threads.
- **Google OAuth Authentication**: Server-side token verification with user profile extraction.

### Frontend
- **Google OAuth Login**: Authentic verification rendering name, email, and avatar inside the sidebar header.
- **Overview Dashboard**: Analytics landing page with stat cards (Scheduled Queue, Delivered, Failed, Rate Limited), a delivery efficiency progress bar with success rate percentage, quick action buttons, and a recent campaign activity stream.
- **Staggered Email Composer**: Full-page compose modal with rich text editor (Bold, Italic, Underline, Lists), inline image insertion, file attachment cards with thumbnails, CSV/TXT lead list upload with email tag pills, Send Later scheduling with time presets, and configurable delay/hourly limit controls.
- **Draggable Split Pane**: The email list and detail view panels are separated by a draggable resizer handle, allowing users to freely adjust the width of each pane by dragging left or right.
- **Dynamic Status Labels**: Each email row displays a clear status label — **Scheduled** (blue, for future jobs), **Sending…** (amber with pulse animation, for jobs past their scheduled time), **Queued** (violet, for rate-limited jobs), **Sent** (green), or **Failed** (red).
- **Interactive Status Filters**: Dropdown filter next to the search bar allowing users to filter the email list by status (Show All, Scheduled/Pending, Sent, Failed, Rate Limited).
- **Real-Time Refresh**: Auto-refresh every 15 seconds with a manual Refresh button. Selected thread details update in place without losing context.
- **Toast Notifications**: Success and error toast popups for campaign submissions and refresh actions.
- **Empty States & Loading Skeletons**: Illustrated empty state placeholders and animated skeleton loaders for smooth UX during data fetching.
- **Attachment Preview Cards**: Uploaded images render as premium thumbnail cards with filenames and file sizes, both inline in the editor and in the email detail view.
- **Responsive Sidebar**: Clean sidebar with ReachInbox branding, user profile card with logout, Compose button, and navigation tabs (Overview, Scheduled, Sent) with live count badges.

---

## 📝 Assumptions, Shortcuts & Trade-offs
1. **Google OAuth Token Logic**: The backend verifies Google OAuth tokens directly. For full production security, an access/refresh token JWT rotation pattern would be added to keep sessions alive.
2. **SQLite vs. MySQL**: MySQL is used to leverage enterprise indexing and ACID transactional safety for logs.
3. **Ethereal Inbox**: Used as the default fake SMTP sandbox. A real SMTP provider can be used by inserting SMTP host and credentials into the `Sender` table.
4. **CSV Parsing**: The parser extracts all email matches from text files, avoiding formatting rigidity (e.g., handles commas, newlines, tabs automatically).
5. **Inline Attachments**: Image attachments are stored as base64 data URLs within the email body HTML for simplicity. For production use, a cloud storage service (e.g., S3) would be preferred.
