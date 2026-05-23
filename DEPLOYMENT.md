# Deployment Guide — Timetable Scheduler

This guide walks you through hosting the app online for free (or low cost) using:

- **MongoDB Atlas** — database  
- **Upstash Redis** — optional caching (app works without it)  
- **Render** — backend (Node.js API)  
- **Vercel** — frontend (React website)  
- **UptimeRobot** — keeps the API awake on Render’s free tier  

You need a **GitHub account** and your project pushed to a GitHub repository.

---

## Before you start

1. Push this project to GitHub (create a repo on [github.com](https://github.com), then upload your code).
2. Have a password manager or notepad ready — you will copy several URLs and secrets.

---

## Section 1 — MongoDB Atlas setup

MongoDB Atlas stores all timetable data in the cloud.

### 1.1 Create an Atlas account

1. Open [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Click **Sign Up** (or **Log In** if you already have an account).
3. Complete registration.

### 1.2 Create a free cluster

1. After login, click **Create** (or **Build a Database**).
2. Choose **M0 FREE** (Shared).
3. Pick a cloud provider and region close to you (e.g. AWS, Mumbai or nearest).
4. Leave the cluster name as **Cluster0** (or choose your own).
5. Click **Create Deployment**.
6. Wait until the cluster status is **Active** (1–3 minutes).

### 1.3 Create a database user

1. When prompted for security, choose **Username and Password**.
2. Set a username (example: `timetable_admin`).
3. Click **Autogenerate Secure Password** and **copy the password** — save it somewhere safe.
4. Click **Create Database User**.

### 1.4 Allow network access

Your API must be allowed to connect from the internet.

1. Go to **Network Access** in the left sidebar  
   (or **Security → Database & Network Access → Network Access**).
2. Click **Add IP Address**.
3. Click **Allow Access from Anywhere** (adds `0.0.0.0/0`).  
   This is fine for learning; for stricter security, add only Render’s IPs later.
4. Click **Confirm**.
5. Wait until the entry shows **Active**.

### 1.5 Copy the connection string

1. Go to **Database** → click **Connect** on your cluster.
2. Choose **Drivers**.
3. Driver: **Node.js**.
4. Copy the connection string. It looks like:

   ```text
   mongodb+srv://timetable_admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

5. Edit the string:
   - Replace `<password>` with your real password (URL-encode special characters like `@`, `#`, `%` if needed).
   - Add the database name **`timetable_scheduler`** before the `?`:

   ```text
   mongodb+srv://timetable_admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/timetable_scheduler?retryWrites=true&w=majority
   ```

6. Save this as your **`MONGO_URI`** — you will paste it into Render later.

---

## Section 2 — Upstash Redis setup (optional but recommended)

Redis caches frequent reads (timetable, subjects, faculty) so the API responds faster.  
If you skip Redis, the app still works — it reads from MongoDB only.

### 2.1 Create an Upstash account

1. Open [https://upstash.com](https://upstash.com).
2. Sign up or log in (GitHub login works).

### 2.2 Create a Redis database

1. Click **Create Database**.
2. Name it (example: `timetable-cache`).
3. Choose a region close to your Render region.
4. Click **Create**.

### 2.3 Copy REST credentials

1. Open your new database.
2. Find the **REST API** section (not the Redis URL alone).
3. Copy:
   - **UPSTASH_REDIS_REST_URL** (starts with `https://`)
   - **UPSTASH_REDIS_REST_TOKEN** (long secret string)
4. Save both — you will add them to Render in Section 3.

---

## Section 3 — Deploy backend to Render

Render runs your Express API 24/7 (with a free tier).

### 3.1 Create a Render account

1. Open [https://render.com](https://render.com).
2. Sign up and connect your **GitHub** account when asked.

### 3.2 Create a new Web Service

1. Click **New +** → **Web Service**.
2. Connect the GitHub repository that contains this project.
3. If asked, grant Render access to your repo.

### 3.3 Configure the service

Use these settings:

| Setting | Value |
|--------|--------|
| **Name** | `college-timetable-api` (or any name you like) |
| **Region** | Closest to you |
| **Branch** | `main` (or your default branch) |
| **Root Directory** | `server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |

> The repo includes a `render.yaml` file with similar defaults. You can use the dashboard form above if the blueprint does not auto-apply.

### 3.4 Add environment variables

In **Environment** (or **Environment Variables**), add each row below.

Generate strong random strings for secrets (use a password generator, 32+ characters).

| Key | Value | Notes |
|-----|--------|--------|
| `NODE_ENV` | `production` | Required |
| `MONGO_URI` | *(paste from Section 1.5)* | Your Atlas connection string |
| `JWT_SECRET` | *(long random string)* | e.g. 32+ random characters |
| `JWT_REFRESH_SECRET` | *(another long random string)* | Different from `JWT_SECRET` |
| `PORT` | `5000` | Render sets `PORT` automatically; `5000` is fine |
| `ALLOWED_ORIGINS` | `http://localhost:4123` | **Temporary** — you will update this in Section 5 |
| `UPSTASH_REDIS_REST_URL` | *(from Section 2.3)* | Leave empty if skipping Redis |
| `UPSTASH_REDIS_REST_TOKEN` | *(from Section 2.3)* | Leave empty if skipping Redis |

Do **not** commit `.env` files to GitHub. Only set variables in Render’s dashboard.

### 3.5 Deploy

1. Click **Create Web Service** (or **Deploy**).
2. Wait for the build to finish (green **Live** status).
3. Copy your public URL from the top of the dashboard, for example:

   ```text
   https://college-timetable-api.onrender.com
   ```

4. Save this as your **backend URL** — you need it for Vercel.

### 3.6 Test the API

Open in a browser:

```text
https://YOUR-BACKEND-URL.onrender.com/api/health
```

You should see JSON like:

```json
{
  "status": "ok",
  "uptime": 12.34,
  "timestamp": "...",
  "dbStatus": "connected"
}
```

If `dbStatus` is `"disconnected"`, check `MONGO_URI` and Atlas **Network Access**.

---

## Section 4 — Deploy frontend to Vercel

Vercel hosts the React website.

### 4.1 Create a Vercel account

1. Open [https://vercel.com](https://vercel.com).
2. Sign up and connect **GitHub**.

### 4.2 Import the project

1. Click **Add New…** → **Project**.
2. Select the same GitHub repository.
3. Click **Import**.

### 4.3 Configure the project

| Setting | Value |
|--------|--------|
| **Framework Preset** | Vite (auto-detected) |
| **Root Directory** | `client` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

### 4.4 Add environment variables

Click **Environment Variables** and add:

| Key | Value |
|-----|--------|
| `VITE_API_URL` | Your Render backend URL from Section 3.5 (no trailing slash) |
| `VITE_COLLEGE_NAME` | Your college name (shown on loading screen and PDFs) |

Example:

```text
VITE_API_URL=https://college-timetable-api.onrender.com
VITE_COLLEGE_NAME=College of Engineering
```

### 4.5 Deploy

1. Click **Deploy**.
2. Wait until the deployment succeeds.
3. Copy your live site URL, for example:

   ```text
   https://timetable-scheduler.vercel.app
   ```

4. Save this as your **frontend URL**.

### 4.6 Open the app

Visit your Vercel URL in a browser. You should see the **login page**.  
If the page loads but login fails, continue to Section 5.

---

## Section 5 — Post-deploy setup

### 5.1 Update `ALLOWED_ORIGINS` on Render

The API only accepts requests from allowed website URLs.

1. Go to your **Render** service → **Environment**.
2. Edit **`ALLOWED_ORIGINS`** to your **Vercel URL** (and keep localhost if you still develop locally):

   ```text
   https://timetable-scheduler.vercel.app,http://localhost:4123
   ```

   Replace with your real Vercel domain. No trailing slash.

3. Save changes — Render will redeploy automatically.

### 5.2 Seed the database (one time)

The seed script creates demo users, departments, subjects, rooms, and sample timetable data.

**Option A — Run on your computer (easiest)**

1. Open a terminal in the project folder.
2. Create `server/.env` locally with the **same** `MONGO_URI` as Render.
3. Run:

   ```bash
   cd server
   npm install
   node seed.js
   ```

4. Wait for **SEED COMPLETE** and note the login credentials printed in the terminal.

**Option B — Run on Render (Shell)**

1. In Render, open your service → **Shell** (if available on your plan).
2. Run:

   ```bash
   node seed.js
   ```

> **Warning:** `node seed.js` **deletes existing data** and recreates everything. Only run it once on a fresh database, or when you intentionally want to reset.

### 5.3 Set up UptimeRobot (keep API awake)

Render’s free tier sleeps after inactivity. UptimeRobot pings your API every 5 minutes so it stays warm.

1. Open [https://uptimerobot.com](https://uptimerobot.com) and create a free account.
2. Click **Add New Monitor**.
3. Settings:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** Timetable API Health
   - **URL:** `https://YOUR-BACKEND-URL.onrender.com/api/health`
   - **Monitoring Interval:** 5 minutes
4. Click **Create Monitor**.
5. When the monitor is **Up**, your health endpoint is reachable.

---

## Section 6 — First login credentials

After a successful seed (`node seed.js`), use these accounts:

### Admin (full access)

| Field | Value |
|--------|--------|
| **Email** | `admin@college.com` |
| **Password** | `Admin@123` |

### HOD — Computer Science (Electronics & Computer Science department in seed)

| Field | Value |
|--------|--------|
| **Email** | `hod.cs@college.com` |
| **Password** | `Hod@123` |

### HOD — Information Technology

| Field | Value |
|--------|--------|
| **Email** | `hod.it@college.com` |
| **Password** | `Hod@123` |

Log in at your **Vercel frontend URL** → `/login`.

> **Security:** Change these passwords after first login in production, or create new users and delete the demo accounts.

---

## Quick troubleshooting

| Problem | What to check |
|--------|----------------|
| Login fails / network error | `VITE_API_URL` on Vercel matches Render URL exactly |
| CORS / blocked origin | `ALLOWED_ORIGINS` on Render includes your Vercel URL |
| `dbStatus: disconnected` | `MONGO_URI` correct; Atlas IP whitelist includes `0.0.0.0/0` |
| API very slow on first request | Normal on free Render after sleep; UptimeRobot helps |
| Empty dropdowns in app | Run `node seed.js` once |
| 401 after some time | Log in again; tokens expire after 8 hours |

---

## Summary checklist

- [ ] MongoDB Atlas cluster live, `MONGO_URI` set on Render  
- [ ] Upstash Redis URL/token set (optional)  
- [ ] Render deployed, `/api/health` returns `"status": "ok"`  
- [ ] Vercel deployed, `VITE_API_URL` points to Render  
- [ ] `ALLOWED_ORIGINS` includes Vercel URL  
- [ ] `node seed.js` run once  
- [ ] UptimeRobot monitoring `/api/health` every 5 minutes  
- [ ] Logged in as admin or HOD successfully  

---

## Local development (optional)

```bash
# From project root
npm run install:all
npm run seed
npm run dev
```

- Frontend: [http://localhost:4123](http://localhost:4123)  
- API: [http://localhost:5000](http://localhost:5000)  

See `README.md` for more development details.
