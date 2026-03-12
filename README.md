# 🚛 TruckBoss Pro

**India's Smart Fleet Command Center** — A full-stack truck transportation management system to manage trucks, drivers, customers, trips, fuel records, and maintenance through a modern professional dashboard.

### 🌐 [Live Demo → truckboss-pro.onrender.com](https://truckboss-pro.onrender.com)

## Features

- 🔐 JWT Authentication with professional split-screen login/register page
- 📊 Dashboard with 6 metric cards — Total Trucks, Drivers, Trips, Revenue, Fuel Cost, Profit
- 📈 Interactive Chart.js charts — Monthly Revenue (bar) & Fuel Trend (line)
- 🔧 Maintenance Forecasting — Trip-based service predictions with color-coded alerts
- 🏆 Driver Performance Leaderboard — Gamified rankings based on trips, revenue & efficiency
- 📉 Advanced Analytics — 12-month trends, trip status breakdown, top drivers
- ⛽ Fuel Efficiency Analysis — Per-truck consumption tracking & monthly trends
- 👥 Customers CRUD — name, phone, address, amount paid, balance
- 🚗 Drivers CRUD — name, licence number, phone, salary, status
- 🚛 Trucks CRUD — truck number, assigned driver, status, maintenance notes
- 🗺️ Trips management — route, truck, driver, customer, amount, status, date
- ⛽ Fuel records tracking — truck, driver, liters, price, date
- 📄 PDF & Excel report exports (trips, fuel, revenue)
- 🔔 Real-time updates via Socket.IO
- 🌙 Dark/Light theme toggle
- 📱 Fully responsive (mobile-friendly)
- 💬 Built-in Support & FAQ
- 🔌 RESTful JSON API with MySQL/TiDB backend

## Access Control (Role-Based)

The app uses a `users.role` value and role middleware to protect APIs.

- Roles: `admin`, `manager`, `driver`
- Middleware: `authorizeRoles(...roles)` validates `req.user.role`
- Token middleware: `authenticateToken` decodes JWT and attaches `req.user`

Example middleware pattern:

```js
function authorizeRoles(...roles) {
	return (req, res, next) => {
		if (!roles.includes(req.user.role)) {
			return res.status(403).json({ message: "Access denied" });
		}
		next();
	};
}
```

## Real-Time Dashboard

Socket.IO powers live updates without page refresh.

- `new_trip`
- `fuel_update`
- `truck_location_update`

Dashboard and operational sections update in real-time based on active view.

## Export Reports

Exports are available via PDF and Excel endpoints.

- `GET /api/reports/trips/pdf`
- `GET /api/reports/trips/excel`
- `GET /api/reports/fuel/excel`
- `GET /api/reports/revenue/pdf`
- `GET /api/reports/revenue/monthly/excel`

Libraries used:

- `pdfkit`
- `exceljs`

## Tech Stack

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Backend   | Node.js, Express.js                     |
| Auth      | JSON Web Tokens (JWT), bcryptjs         |
| Database  | MySQL 8.0+ / TiDB Cloud (Serverless)   |
| Frontend  | HTML5, CSS3, Vanilla JavaScript         |
| Real-time | Socket.IO                               |
| Charts    | Chart.js                                |
| Icons     | Font Awesome 6.4                        |
| Reports   | PDFKit, ExcelJS                         |
| Hosting   | Render (Web Service)                    |

## Prerequisites

- Node.js 18+
- MySQL 8.0+
- npm 9+

## Installation

```bash
# 1. Clone the repo
git clone https://github.com/Ashishkumar9896/TruckBoss-Pro.git
cd TruckBoss-Pro

# 2. Install dependencies
npm install

# 3. Set up the MySQL database (creates schema)
mysql -u root -p < database/setup.sql

# 4. (Optional) Load sample seed data
mysql -u root -p < database/seed_data.sql

# 5. Configure environment variables
cp .env.example .env
# Edit .env — set DB_PASSWORD and optionally change JWT_SECRET

# 6. Start the development server
npm run dev

# 7. Open your browser
#    http://localhost:3000
```

## Environment Variables (.env)

| Variable       | Default                              | Description                       |
|----------------|--------------------------------------|-----------------------------------|
| DB_HOST        | localhost                            | MySQL / TiDB host                 |
| DB_USER        | root                                 | Database username                 |
| DB_PASSWORD    | your_password_here                   | Database password                 |
| DB_NAME        | trucks                               | Database name                     |
| DB_PORT        | 3306                                 | Database port (TiDB uses 4000)    |
| DB_SSL         | false                                | Enable SSL (set `true` for TiDB)  |
| PORT           | 3000                                 | Express server port               |
| FRONTEND_ORIGIN| http://localhost:3000                | Allowed CORS frontend origin      |
| JWT_SECRET     | TruckBoss_Super_Secret_Key_2026_...  | JWT signing secret                |
| JWT_EXPIRES_IN | 7d                                   | JWT expiry duration               |
| NODE_ENV       | development                          | Environment (production in deploy)|

## API Endpoints

### Auth
| Method | Endpoint              | Description              |
|--------|-----------------------|--------------------------|
| POST   | /api/auth/register    | Register a new user      |
| POST   | /api/auth/login       | Login and receive JWT    |

### Dashboard *(requires Bearer token)*
| Method | Endpoint                       | Description                  |
|--------|--------------------------------|------------------------------|
| GET    | /api/dashboard/stats           | Aggregate stats              |
| GET    | /api/dashboard/revenue-chart   | Top 10 customers by revenue  |

### Customers *(requires Bearer token)*
| Method | Endpoint              | Description              |
|--------|-----------------------|--------------------------|
| GET    | /api/customers        | List all customers       |
| GET    | /api/customers/:id    | Get customer by ID       |
| POST   | /api/customers        | Create customer          |
| PUT    | /api/customers/:id    | Update customer          |
| DELETE | /api/customers/:id    | Delete customer          |

### Drivers *(requires Bearer token)*
| Method | Endpoint          | Description         |
|--------|-------------------|---------------------|
| GET    | /api/drivers      | List all drivers    |
| GET    | /api/drivers/:id  | Get driver by ID    |
| POST   | /api/drivers      | Create driver       |
| PUT    | /api/drivers/:id  | Update driver       |
| DELETE | /api/drivers/:id  | Delete driver       |

### Trucks *(requires Bearer token)*
| Method | Endpoint                   | Description              |
|--------|----------------------------|--------------------------|
| GET    | /api/trucks                | List all trucks          |
| GET    | /api/trucks/:id            | Get truck by ID          |
| POST   | /api/trucks                | Create truck             |
| PUT    | /api/trucks/:id            | Update truck             |
| DELETE | /api/trucks/:id            | Delete truck             |
| GET    | /api/trucks/summary/status | Status count summary     |

### Trips *(requires Bearer token)*
| Method | Endpoint        | Description      |
|--------|-----------------|------------------|
| GET    | /api/trips      | List all trips   |
| POST   | /api/trips      | Create trip      |
| PUT    | /api/trips/:id  | Update trip      |
| DELETE | /api/trips/:id  | Delete trip      |

### Fuel *(requires Bearer token)*
| Method | Endpoint       | Description              |
|--------|----------------|--------------------------|
| GET    | /api/fuel      | List all fuel records    |
| POST   | /api/fuel      | Add fuel record          |
| DELETE | /api/fuel/:id  | Delete fuel record       |

### Reports *(requires Bearer token, admin/manager)*
| Method | Endpoint                            | Description                      |
|--------|-------------------------------------|----------------------------------|
| GET    | /api/reports/trips/pdf              | Export trips PDF                 |
| GET    | /api/reports/trips/excel            | Export trips Excel               |
| GET    | /api/reports/fuel/excel             | Export fuel Excel                |
| GET    | /api/reports/revenue/pdf            | Export monthly revenue PDF       |
| GET    | /api/reports/revenue/monthly/excel  | Export monthly revenue Excel     |

## UI Highlights

- Professional split-screen auth page with animated branding
- Collapsible glassmorphism sidebar with gradient navigation
- 6 animated metric cards with live data
- Interactive Chart.js visualizations
- Maintenance forecast table with color-coded status badges
- Dark/Light theme toggle (persists across sessions)
- Topbar with notifications, settings dropdown, support & FAQ
- Responsive design — works on desktop, tablet, and mobile
- Toast notifications for user feedback
- Loading spinners and error states

## Project Structure

```
TruckBoss-Pro/
├── server.js                  # Express server entry point
├── render.yaml                # Render deployment blueprint
├── package.json               # Node.js dependencies
├── database/
│   ├── setup.sql              # MySQL/TiDB schema (table creation)
│   └── seed_data.sql          # Sample data for all tables
├── public/
│   ├── index.html             # Single-page frontend app
│   ├── style.css              # Dark/Light themed responsive CSS
│   └── app.js                 # Frontend JavaScript (API-connected)
├── server/
│   ├── config/db.js           # MySQL/TiDB connection pool (SSL support)
│   ├── controllers/           # Route handlers (auth, dashboard, CRUD, analytics)
│   ├── middleware/             # Auth, validation, error handling, permissions
│   ├── models/                # Database query functions
│   ├── routes/                # Express route definitions
│   ├── scripts/backup.js      # Automated database backup
│   ├── utils/auditLogger.js   # Audit logging utility
│   └── socket.js              # Socket.IO real-time events
└── README.md
```

## Deployment

Deployed on **Render** with **TiDB Cloud** (Serverless MySQL):

1. Push to GitHub → Render auto-deploys from `main` branch
2. Database hosted on TiDB Cloud (free tier, SSL enabled)
3. Environment variables configured in Render dashboard

## License

MIT