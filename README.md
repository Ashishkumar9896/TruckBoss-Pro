# 🚛 TruckBoss Pro

**India's Smart Fleet Command Center** — Manage trucks, drivers, fuel, and revenue all in one dashboard.

## Features

- JWT Authentication (Register/Login)
- Dashboard with live stats and Chart.js charts
- Customers CRUD management
- Drivers CRUD with licence tracking
- Trucks CRUD with fleet status pie chart
- Trips management with route visualization
- Fuel records tracking
- Dark-themed responsive UI
- RESTful API with MySQL backend

## Tech Stack

- **Backend:** Node.js, Express.js, MySQL2, JWT, bcrypt
- **Frontend:** HTML5, CSS3, JavaScript, Chart.js, Remix Icons
- **Database:** MySQL 8.0+

## Quick Start

```bash
# Clone the repo
git clone https://github.com/Ashishkumar9896/TruckBoss-Pro.git
cd TruckBoss-Pro

# Install dependencies
npm install

# Setup MySQL database
mysql -u root -p < database/setup.sql
mysql -u root -p < database/seed_data.sql

# Configure environment
cp .env.example .env
# Edit .env with your MySQL password

# Start the server
npm run dev

# Open http://localhost:3000
```

## License

MIT