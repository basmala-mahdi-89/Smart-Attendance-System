# Smart Attendance System

A modern attendance management system for universities and colleges. It replaces paper-based attendance with dynamic QR codes, live tracking, and safeguards against common forms of attendance fraud.

## Features

- **Role-based access control:** Dean, Head of Department, Doctor, Engineer, and Student roles.
- **Dynamic QR codes:** Doctors can generate QR codes that refresh every five seconds to reduce screenshot sharing.
- **Live attendance tracking:** Doctors can see attendance activity in real time using Socket.IO.
- **Anti-cheat safeguards:** Device fingerprinting, duplicate attendance prevention, and a limit of three login attempts per day.
- **Automatic course enrollment:** Approved students are enrolled in courses based on their major and academic year.
- **Invitation system:** Email invitations for adding department heads, doctors, and engineers.
- **Manual attendance fallback:** Students can display a personal QR code for manual scanning when they have no internet connection.
- **Automated absence warnings:** Doctors can configure absence limits, and the system sends warnings automatically.
- **Reports and export:** Attendance reports with CSV export.

## Technology Stack

### Frontend

- React.js with Vite
- React Router DOM
- Axios
- Socket.IO Client
- HTML5-QRCode
- QRCode.React

### Backend

- Node.js and Express.js
- PostgreSQL hosted on Neon
- Socket.IO
- JSON Web Tokens (JWT)
- Nodemailer
- Bcrypt

## Prerequisites

- Node.js 18 or later
- Git
- A PostgreSQL database (for example, a Neon database)
- Email account credentials if email invitations are needed

## Run Locally

### 1. Clone the repository

Replace the URL below with the repository URL:

```bash
git clone https://github.com/basmala.mahdi.89/Smart-Attendance-System.git
cd Smart-Attendance-System
```

### 2. Configure and run the backend

```bash
cd Backend
npm install
```

Copy the example environment file and add your own values:

```bash
cp .env.example .env
```

Set the values required by the backend in `Backend/.env`. At minimum, configure:

- `DATABASE_URL`: Your PostgreSQL connection string.
- `EMAIL_USER` and `EMAIL_PASS`: The email account and app password used to send messages.
- `FRONTEND_URL`: The URL where the frontend is running, such as `http://localhost:5173`.

Do not commit `.env` or place real credentials in `.env.example`.

Run the database migration and seed scripts:

```bash
node src/config/migrate.js
node src/seeds/seed.js
```

Start the backend:

```bash
npm run dev
```

The backend runs at `http://localhost:5000`.

### 3. Run the frontend

Open another terminal from the repository root:

```bash
cd Frontend
npm install
npm run dev -- --host
```

The frontend runs at `http://localhost:5173`.

## Seeded Dean Account

After running the seed script, use these credentials to sign in as the Dean:

- **Role:** Dean
- **National ID:** `10000000000001`
- **Password:** `Dean@12345`

Change or remove default credentials before using the system outside local development.

## Project Structure

```text
Smart-Attendance-System/
├── Backend/
│   ├── src/
│   │   ├── config/        # Database and Socket.IO configuration
│   │   ├── controllers/   # Request handlers
│   │   ├── middleware/    # Authentication and role checks
│   │   ├── migrations/    # Database schema and migrations
│   │   ├── routes/        # Express routes
│   │   ├── seeds/         # Initial data, including the Dean account
│   │   └── utils/         # Email and validation utilities
│   └── .env.example
├── Frontend/
│   └── src/
│       ├── api/           # API and Socket.IO clients
│       ├── components/    # Reusable UI components
│       ├── context/       # Authentication context
│       └── pages/         # Authentication pages and dashboards
└── README.md
```


