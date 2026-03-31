# Bihal Suppliers — Fleet Management System

A web-based fleet management system for tracking trucks, drivers, customers, trips, fuel, and maintenance. Built with Node.js, Express, and MySQL.

## Features

- JWT-based login (admin / manager roles)
- Dashboard with revenue, profit, fuel, and maintenance stats
- Trucks, Drivers, Customers — full CRUD
- Trip management with material type and tonnage
- Fuel records with per-truck consumption tracking
- Maintenance log with photo/PDF proof upload (Cloudinary)
- Monthly PDF and Excel report exports
- Real-time updates via Socket.IO
- Dark/Light theme, mobile responsive

## Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** MySQL 8.0 / TiDB Cloud
- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Auth:** JWT + bcryptjs
- **Real-time:** Socket.IO
- **Charts:** Chart.js
- **Reports:** PDFKit, ExcelJS
- **File Storage:** Cloudinary (maintenance proofs)
- **Hosting:** Render

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/Ashishkumar9896/TruckBoss-Pro.git
cd TruckBoss-Pro
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up the database

Create a MySQL database named `trucks` and import the schema:

```bash
mysql -u root -p trucks < database.sql
```

### 4. Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Key variables:
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
- `JWT_SECRET` — use a long random string
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — for proof uploads

### 5. Start the server

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment (Render)

1. Push to GitHub → Render auto-deploys from `main`
2. Add all environment variables in Render dashboard
3. Use TiDB Cloud (or any MySQL-compatible DB) with SSL enabled

## Project Structure

```
├── server.js              # Entry point
├── package.json
├── database.sql           # MySQL schema
├── public/                # Frontend
│   ├── index.html
│   ├── app.js
│   └── style.css
├── server/
│   ├── config/            # DB connection
│   ├── controllers/       # Route handlers
│   ├── middleware/        # Auth, validation
│   ├── models/            # DB query functions
│   ├── routes/            # API routes
│   ├── scripts/           # Cron jobs (backup)
│   ├── services/          # Cloudinary storage
│   └── socket.js          # Socket.IO events
└── .env.example
```

## License

MIT
