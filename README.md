# Timetable Scheduler

A MERN stack college timetable management system with role-based access for **Admins** and **Heads of Department (HODs)**.

## Features

- **Admin**: Manage departments, faculty, subjects, rooms, timetables, and change requests
- **HOD**: View department timetable (print/PDF), monitor faculty workload, request slot changes
- Conflict detection for double-booked faculty or rooms
- Draft / published timetable slots
- JWT authentication with protected routes

## Tech Stack

| Layer    | Technology                          |
| -------- | ----------------------------------- |
| Frontend | React, Vite, Tailwind CSS           |
| Backend  | Node.js, Express, Mongoose          |
| Database | MongoDB                             |

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [MongoDB](https://www.mongodb.com/) running locally or a MongoDB Atlas URI

## Project Structure

```
Timetable Scheduler/
├── client/          # React + Vite frontend
├── server/          # Express API
├── package.json     # Root scripts (run both apps)
└── README.md
```

## Setup

### 1. Install dependencies

From the project root:

```bash
npm run install:all
```

### 2. Configure the server (security)

`server/.env` must include:

```env
ALLOWED_ORIGINS=http://localhost:4123,http://localhost:5173
JWT_SECRET=your_secure_random_secret
JWT_REFRESH_SECRET=another_secure_random_secret
```

Access tokens expire in **8 hours**. Refresh tokens are stored in an **httpOnly** cookie (`/api/auth/refresh`).

Optional **Upstash Redis** caching (5 min TTL on timetable, subjects, faculty reads):

```env
UPSTASH_REDIS_REST_URL=https://....upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

If Redis is not configured, the API uses MongoDB only.

### 3. Configure the server (database)

Copy the example env file and edit it:

```bash
cd server
copy .env.example .env
```

On macOS/Linux use `cp .env.example .env`.

Edit `server/.env`:

```env
MONGO_URI=mongodb://localhost:27017/timetable_scheduler
JWT_SECRET=your_secure_random_secret
PORT=5000
```

> **Important:** `PORT` must match `VITE_API_URL` in the client (default `http://localhost:5000`).

### 4. Configure the client

```bash
cd client
copy .env.example .env
```

`client/.env`:

```env
VITE_API_URL=http://localhost:5000
```

### 5. Seed the database

From the project root:

```bash
npm run seed
```

This creates:

| Resource   | Details |
| ---------- | ------- |
| Admin      | `admin@college.com` / `Admin@123` |
| HOD        | `hod@cs.com` / `Hod@123` (Computer Science) |
| Department | Computer Science (CS) |
| Faculty    | 5 sample members |
| Subjects   | 5 sample subjects |
| Rooms      | 3 rooms (lecture, lab, seminar) |

### 6. Run the application

From the project root:

```bash
npm run dev
```

- **Frontend:** http://localhost:4123  
- **API:** http://localhost:5000  

## Scripts

| Command            | Description                          |
| ------------------ | ------------------------------------ |
| `npm run dev`      | Start client and server concurrently |
| `npm run server`   | Start API only                       |
| `npm run client`   | Start frontend only                  |
| `npm run seed`     | Seed MongoDB with sample data        |
| `npm run install:all` | Install all dependencies          |

## Default Login

| Role  | Email               | Password   |
| ----- | ------------------- | ---------- |
| Admin | admin@college.com   | Admin@123  |
| HOD   | hod@cs.com          | Hod@123    |

After login you are redirected to `/admin` or `/hod` based on your role.

## API Overview

| Prefix               | Description                |
| -------------------- | -------------------------- |
| `/api/auth`          | Login, logout, refresh, me |
| `/api/departments`   | Department CRUD            |
| `/api/faculty`       | Faculty CRUD + workload    |
| `/api/subjects`      | Subject CRUD               |
| `/api/rooms`         | Room CRUD                  |
| `/api/timetable`     | Slots, conflicts, publish  |
| `/api/changerequest` | Change requests            |
| `/api/users`         | User list (admin)          |

## Troubleshooting

**Cannot connect to API**

- Ensure the server is running and `PORT` in `server/.env` equals the host in `client/.env` (`VITE_API_URL`).

**Login fails after seed**

- Re-run `npm run seed` (this clears and recreates users).
- Check MongoDB is running and `MONGO_URI` is correct.

**Empty dropdowns in timetable modal**

- Run the seed script or add subjects, faculty, and rooms via the admin panel.

## License

MIT
