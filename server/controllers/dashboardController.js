const pool = require("../config/db");
const { getDashboardStats, getRevenueChart } = require("../models/customerModel");

async function getStats(req, res, next) {
  try {
    const { customers, revenue, balance, trucks, truckStatus, trips, drivers, fuel } = await getDashboardStats();

    const billedTotal = Number(revenue.total) + Number(balance.total);
    const collectionRate = billedTotal > 0 ? (Number(revenue.total) / billedTotal) * 100 : 0;

    const statusMap = {};
    truckStatus.forEach((row) => {
      statusMap[row.status] = row.count;
    });

    return res.json({
      customers: customers.count,
      revenue: revenue.total,
      balanceAmount: balance.total,
      trucks: trucks.count,
      trucksAvailable: statusMap.Available || 0,
      trucksInUse: statusMap["In Use"] || 0,
      trucksMaintenance: statusMap.Maintenance || 0,
      trips: trips.count,
      drivers: drivers.count,
      fuelCost: fuel.total,
      collectionRate: Number(collectionRate.toFixed(2)),
    });
  } catch (err) {
    return next(err);
  }
}

async function getRevenueChartData(req, res, next) {
  try {
    const rows = await getRevenueChart();
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

async function getDashboardMetrics(req, res, next) {
  try {
    const [[metrics]] = await pool.query(
      `SELECT
          (SELECT COUNT(*) FROM truck_details) AS totalTrucks,
          (SELECT COUNT(*) FROM truck_details WHERE status = 'In Use') AS activeTrucks,
          (
            SELECT COALESCE(SUM(amount), 0)
            FROM trips
            WHERE YEAR(trip_date) = YEAR(CURRENT_DATE())
              AND MONTH(trip_date) = MONTH(CURRENT_DATE())
          ) AS monthlyRevenue,
          (SELECT COALESCE(SUM(price), 0) FROM fuel_details) AS fuelExpenses,
          (
            (SELECT COALESCE(SUM(amount), 0) FROM trips) -
            (SELECT COALESCE(SUM(price), 0) FROM fuel_details) -
            (SELECT COALESCE(SUM(salary), 0) FROM driver_details)
          ) AS profit`
    );

    return res.json({
      totalTrucks: Number(metrics.totalTrucks || 0),
      activeTrucks: Number(metrics.activeTrucks || 0),
      monthlyRevenue: Number(metrics.monthlyRevenue || 0),
      fuelExpenses: Number(metrics.fuelExpenses || 0),
      profit: Number(metrics.profit || 0),
    });
  } catch (err) {
    return next(err);
  }
}

async function getDashboardAnalytics(req, res, next) {
  try {
    const [monthlyRevenue] = await pool.query(
      `SELECT DATE_FORMAT(trip_date, '%Y-%m') AS month,
              COALESCE(SUM(amount), 0) AS revenue
       FROM trips
       WHERE trip_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 11 MONTH)
       GROUP BY DATE_FORMAT(trip_date, '%Y-%m')
       ORDER BY month ASC`
    );

    const [monthlyFuelCost] = await pool.query(
      `SELECT DATE_FORMAT(fuel_date, '%Y-%m') AS month,
              COALESCE(SUM(price), 0) AS fuelCost
       FROM fuel_details
       WHERE fuel_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 11 MONTH)
       GROUP BY DATE_FORMAT(fuel_date, '%Y-%m')
       ORDER BY month ASC`
    );

    const [tripStatusBreakdown] = await pool.query(
      `SELECT status, COUNT(*) AS count
       FROM trips
       GROUP BY status
       ORDER BY count DESC`
    );

    const [topDriversByRevenue] = await pool.query(
      `SELECT d.driver_id,
              d.name AS driver_name,
              COALESCE(SUM(tr.amount), 0) AS revenue
       FROM driver_details d
       LEFT JOIN trips tr ON d.driver_id = tr.driver_id
       GROUP BY d.driver_id, d.name
       ORDER BY revenue DESC
       LIMIT 5`
    );

    return res.json({
      monthlyRevenue: monthlyRevenue.map((row) => ({
        month: row.month,
        revenue: Number(row.revenue || 0),
      })),
      monthlyFuelCost: monthlyFuelCost.map((row) => ({
        month: row.month,
        fuelCost: Number(row.fuelCost || 0),
      })),
      tripStatusBreakdown: tripStatusBreakdown.map((row) => ({
        status: row.status,
        count: Number(row.count || 0),
      })),
      topDriversByRevenue: topDriversByRevenue.map((row) => ({
        driver_id: row.driver_id,
        driver_name: row.driver_name,
        revenue: Number(row.revenue || 0),
      })),
    });
  } catch (err) {
    return next(err);
  }
}

async function getFuelEfficiency(req, res, next) {
  try {
    const [fuelByTruck] = await pool.query(
      `SELECT t.truck_no,
              COALESCE(SUM(f.liters), 0) AS total_liters,
              COALESCE(SUM(f.price), 0) AS total_cost,
              COUNT(f.fuel_id) AS refuels
       FROM truck_details t
       LEFT JOIN fuel_details f ON t.truck_id = f.truck_id
       GROUP BY t.truck_id, t.truck_no
       ORDER BY total_cost DESC`
    );

    const [monthlyTrend] = await pool.query(
      `SELECT DATE_FORMAT(fuel_date, '%Y-%m') AS month,
              COALESCE(SUM(liters), 0) AS liters,
              COALESCE(SUM(price), 0) AS cost
       FROM fuel_details
       WHERE fuel_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(fuel_date, '%Y-%m')
       ORDER BY month ASC`
    );

    return res.json({
      fuelByTruck: fuelByTruck.map(row => ({
        truck_no: row.truck_no,
        total_liters: Number(row.total_liters || 0),
        total_cost: Number(row.total_cost || 0),
        refuels: Number(row.refuels || 0)
      })),
      monthlyTrend: monthlyTrend.map(row => ({
        month: row.month,
        liters: Number(row.liters || 0),
        cost: Number(row.cost || 0)
      }))
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getStats,
  getRevenueChartData,
  getDashboardMetrics,
  getDashboardAnalytics,
  getFuelEfficiency,
};
