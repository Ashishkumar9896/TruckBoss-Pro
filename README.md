# 🚛 TruckBoss Pro

**India's Smart Fleet Command Center** — A full-stack truck transportation management system to manage trucks, drivers, customers, trips, and fuel records through a modern dark-themed dashboard.

## Features

- 🔐 JWT Authentication (Register / Login with bcrypt password hashing)
- 📊 Dashboard with live stats cards and Chart.js charts (revenue bar + fleet status doughnut)
- 👥 Customers CRUD — name, phone, address, amount paid, balance
- 🚗 Drivers CRUD — name, licence number, phone, salary, status
- 🚛 Trucks CRUD — truck number, assigned driver, status, maintenance notes
- 🗺️ Trips management — route, truck, driver, customer, amount, status, date
- ⛽ Fuel records tracking — truck, driver, liters, price, date
- 🌙 Dark-themed responsive UI (mobile-friendly)
- 🔌 RESTful JSON API with MySQL backend

## Tech Stack

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Backend   | Node.js, Express.js                     |
| Auth      | JSON Web Tokens (JWT), bcryptjs         |
| Database  | MySQL 8.0+, mysql2 (promise pool)       |
| Frontend  | HTML5, CSS3, Vanilla JavaScript         |
| Charts    | Chart.js                                |
| Icons     | Remix Icon 4.9.0                        |

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

| Variable       | Default                              | Description                  |
|----------------|--------------------------------------|------------------------------|
| DB_HOST        | localhost                            | MySQL host                   |
| DB_USER        | root                                 | MySQL username               |
| DB_PASSWORD    | your_password_here                   | MySQL password               |
| DB_NAME        | trucks                               | MySQL database name          |
| DB_PORT        | 3306                                 | MySQL port                   |
| PORT           | 3000                                 | Express server port          |
| JWT_SECRET     | TruckBoss_Super_Secret_Key_2026_...  | JWT signing secret           |
| JWT_EXPIRES_IN | 7d                                   | JWT expiry duration          |

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

## Project Structure

```
TruckBoss-Pro/
├── server.js                  # Express server + REST API routes
├── package.json               # Node.js dependencies
├── .env.example               # Environment variables template
├── .gitignore                 # Ignore node_modules, .env
├── database/
│   ├── setup.sql              # MySQL schema (table creation)
│   └── seed_data.sql          # Sample data for all tables
├── public/
│   ├── index.html             # Single-page frontend app
│   ├── style.css              # Dark-themed responsive CSS
│   └── app.js                 # Frontend JavaScript (API-connected)
└── README.md                  # This file
```

## License

MIT