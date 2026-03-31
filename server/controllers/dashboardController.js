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
          (SELECT COUNT(*) FROM driver_details) AS totalDrivers,
          (SELECT COUNT(*) FROM trips) AS totalTrips,
          (SELECT COUNT(*) FROM trips WHERE status IN ('pending', 'ongoing')) AS activeTrips,
          (SELECT COUNT(*) FROM truck_details WHERE LOWER(status) = 'available' AND truck_id NOT IN (
             SELECT DISTINCT truck_id FROM trips WHERE status IN ('pending', 'ongoing') AND truck_id IS NOT NULL
           )) AS idleTrucks,
          (SELECT COALESCE(SUM(COALESCE(amount, 0)), 0) FROM trips) AS totalRevenue,
          (SELECT COALESCE(SUM(amount), 0) FROM customer_transactions WHERE DATE(payment_date) = CURDATE()) AS todayCollection,
          (SELECT COALESCE(SUM(GREATEST(balance - amount_paid, 0)), 0) FROM customers) AS pendingCustomerDues,
          (SELECT COALESCE(SUM(COALESCE(amount, 0)), 0) FROM trips WHERE DATE(trip_date) = CURDATE()) AS dailyRevenue,
          (SELECT COALESCE(SUM(COALESCE(amount, 0)), 0) FROM trips
            WHERE YEAR(trip_date) = YEAR(CURDATE()) AND MONTH(trip_date) = MONTH(CURDATE())) AS monthlyRevenue,
          (SELECT COALESCE(SUM(COALESCE(amount, 0)), 0) FROM trips
            WHERE YEAR(trip_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
              AND MONTH(trip_date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))) AS previousMonthRevenue,
          (SELECT COALESCE(SUM(amount), 0) FROM customer_transactions
            WHERE YEAR(payment_date) = YEAR(CURDATE()) AND MONTH(payment_date) = MONTH(CURDATE())) AS monthlyCollection,
          (SELECT COALESCE(SUM(amount), 0) FROM customer_transactions
            WHERE YEAR(payment_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
              AND MONTH(payment_date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))) AS previousMonthCollection,
          (SELECT COALESCE(SUM(price), 0) FROM fuel_details
            WHERE YEAR(fuel_date) = YEAR(CURDATE()) AND MONTH(fuel_date) = MONTH(CURDATE())) AS monthlyFuelExpenses,
          (SELECT COALESCE(SUM(price), 0) FROM fuel_details
            WHERE YEAR(fuel_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
              AND MONTH(fuel_date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))) AS previousMonthFuelExpenses,
          (SELECT COALESCE(SUM(cost), 0) FROM maintenance_records
            WHERE YEAR(service_date) = YEAR(CURDATE()) AND MONTH(service_date) = MONTH(CURDATE())) AS monthlyMaintenanceCost,
          (SELECT COALESCE(SUM(cost), 0) FROM maintenance_records
            WHERE YEAR(service_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
              AND MONTH(service_date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))) AS previousMonthMaintenanceCost,
          (SELECT COUNT(*) FROM truck_details
            WHERE LOWER(TRIM(COALESCE(maintenance, ''))) <> 'not required' AND TRIM(COALESCE(maintenance, '')) <> '') AS trucksDueForService,
          (
            SELECT (SELECT COALESCE(SUM(COALESCE(amount, 0)), 0) FROM trips
                    WHERE YEAR(trip_date) = YEAR(CURDATE()) AND MONTH(trip_date) = MONTH(CURDATE()))
                   - (SELECT COALESCE(SUM(price), 0) FROM fuel_details
                      WHERE YEAR(fuel_date) = YEAR(CURDATE()) AND MONTH(fuel_date) = MONTH(CURDATE()))
          ) AS monthlyProfit,
          (
            SELECT COALESCE(SUM(COALESCE(amount, 0)), 0) FROM trips
            WHERE DATE(trip_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
          ) AS yesterdayRevenue,
          (SELECT COALESCE(SUM(price), 0) FROM fuel_details) AS totalFuelExpenses,
          (
            (SELECT COALESCE(SUM(COALESCE(amount, 0)), 0) FROM trips) -
            (SELECT COALESCE(SUM(price), 0) FROM fuel_details)
          ) AS totalProfit`
    );

    const [topCustomersThisMonth] = await pool.query(
      `SELECT c.customer_id, c.name, COALESCE(SUM(tr.amount), 0) AS billed_amount
       FROM customers c
       LEFT JOIN trips tr ON c.customer_id = tr.customer_id
        AND YEAR(tr.trip_date) = YEAR(CURDATE())
        AND MONTH(tr.trip_date) = MONTH(CURDATE())
       GROUP BY c.customer_id, c.name
       ORDER BY billed_amount DESC
       LIMIT 5`
    );

    const [mostProfitableTruck] = await pool.query(
      `SELECT t.truck_id, t.truck_no,
              COALESCE(SUM(tr.amount), 0) - COALESCE(SUM(fd.daily_fuel_cost), 0) AS net_profit
       FROM truck_details t
       LEFT JOIN trips tr ON t.truck_id = tr.truck_id
        AND YEAR(tr.trip_date) = YEAR(CURDATE())
        AND MONTH(tr.trip_date) = MONTH(CURDATE())
       LEFT JOIN (
          SELECT truck_id, DATE(fuel_date) AS fuel_day, SUM(price) AS daily_fuel_cost
          FROM fuel_details
          GROUP BY truck_id, DATE(fuel_date)
       ) fd ON fd.truck_id = tr.truck_id AND fd.fuel_day = DATE(tr.trip_date)
       GROUP BY t.truck_id, t.truck_no
       ORDER BY net_profit DESC
       LIMIT 1`
    );

    const [recentActivity] = await pool.query(
      `SELECT * FROM (
          SELECT created_at AS activity_at, 'trip' AS activity_type,
                 CONCAT('Trip #', trip_id, ' added') AS title,
                 status AS meta
          FROM trips
          UNION ALL
          SELECT created_at AS activity_at, 'payment' AS activity_type,
                 CONCAT('Payment received from customer #', customer_id) AS title,
                 CONCAT('Rs.', FORMAT(amount, 0)) AS meta
          FROM customer_transactions
          UNION ALL
          SELECT created_at AS activity_at, 'fuel' AS activity_type,
                 CONCAT('Fuel logged for truck #', truck_id) AS title,
                 CONCAT('Rs.', FORMAT(price, 0)) AS meta
          FROM fuel_details
          UNION ALL
          SELECT created_at AS activity_at, 'maintenance' AS activity_type,
                 CONCAT('Maintenance logged for truck #', truck_id) AS title,
                 CONCAT('Rs.', FORMAT(cost, 0)) AS meta
          FROM maintenance_records
       ) activity
       ORDER BY activity_at DESC
       LIMIT 10`
    );

    const [notifications] = await pool.query(
      `SELECT *
       FROM (
          SELECT CONCAT('payment-overdue-', customer_id) AS notification_id,
                 'overdue_payment' AS notification_type,
                 CONCAT(name, ' has overdue payment of Rs.', FORMAT(GREATEST(balance - amount_paid, 0), 0)) AS message,
                 COALESCE(due_date, CURDATE()) AS sort_date
          FROM customers
          WHERE due_date IS NOT NULL AND due_date < CURDATE() AND GREATEST(balance - amount_paid, 0) > 0

          UNION ALL

          SELECT CONCAT('payment-due-', customer_id) AS notification_id,
                 'payment_due_today' AS notification_type,
                 CONCAT(name, ' payment is due today') AS message,
                 due_date AS sort_date
          FROM customers
          WHERE due_date = CURDATE() AND GREATEST(balance - amount_paid, 0) > 0

          UNION ALL

          SELECT CONCAT('service-due-', truck_id) AS notification_id,
                 'service_due' AS notification_type,
                 CONCAT(truck_no, ' is due for service') AS message,
                 CURDATE() AS sort_date
          FROM truck_details
          WHERE LOWER(TRIM(COALESCE(maintenance, ''))) <> 'not required' AND TRIM(COALESCE(maintenance, '')) <> ''

          UNION ALL

          SELECT CONCAT('idle-truck-', truck_id) AS notification_id,
                 'idle_truck' AS notification_type,
                 CONCAT(truck_no, ' is idle with no active trip') AS message,
                 CURDATE() AS sort_date
          FROM truck_details
          WHERE LOWER(status) = 'available'
            AND truck_id NOT IN (
              SELECT DISTINCT truck_id FROM trips WHERE status IN ('pending', 'ongoing') AND truck_id IS NOT NULL
            )

          UNION ALL

          SELECT CONCAT('pending-trip-', trip_id) AS notification_id,
                 'pending_trip_completion' AS notification_type,
                 CONCAT('Trip #', trip_id, ' is still ', status) AS message,
                 trip_date AS sort_date
          FROM trips
          WHERE status IN ('pending', 'ongoing')
       ) n
       ORDER BY sort_date DESC
       LIMIT 15`
    );

    return res.json({
      totalTrucks: Number(metrics.totalTrucks || 0),
      totalDrivers: Number(metrics.totalDrivers || 0),
      totalTrips: Number(metrics.totalTrips || 0),
      activeTrips: Number(metrics.activeTrips || 0),
      idleTrucks: Number(metrics.idleTrucks || 0),
      totalRevenue: Number(metrics.totalRevenue || 0),
      dailyRevenue: Number(metrics.dailyRevenue || 0),
      monthlyRevenue: Number(metrics.monthlyRevenue || 0),
      previousMonthRevenue: Number(metrics.previousMonthRevenue || 0),
      todayCollection: Number(metrics.todayCollection || 0),
      monthlyCollection: Number(metrics.monthlyCollection || 0),
      previousMonthCollection: Number(metrics.previousMonthCollection || 0),
      pendingCustomerDues: Number(metrics.pendingCustomerDues || 0),
      monthlyProfit: Number(metrics.monthlyProfit || 0),
      monthlyFuelExpenses: Number(metrics.monthlyFuelExpenses || 0),
      previousMonthFuelExpenses: Number(metrics.previousMonthFuelExpenses || 0),
      monthlyMaintenanceCost: Number(metrics.monthlyMaintenanceCost || 0),
      previousMonthMaintenanceCost: Number(metrics.previousMonthMaintenanceCost || 0),
      trucksDueForService: Number(metrics.trucksDueForService || 0),
      yesterdayRevenue: Number(metrics.yesterdayRevenue || 0),
      fuelExpenses: Number(metrics.totalFuelExpenses || 0),
      profit: Number(metrics.totalProfit || 0),
      topCustomersThisMonth: topCustomersThisMonth.map((row) => ({
        customer_id: row.customer_id,
        name: row.name,
        billed_amount: Number(row.billed_amount || 0),
      })),
      mostProfitableTruck: mostProfitableTruck[0]
        ? {
            truck_id: mostProfitableTruck[0].truck_id,
            truck_no: mostProfitableTruck[0].truck_no,
            net_profit: Number(mostProfitableTruck[0].net_profit || 0),
          }
        : null,
      recentActivity: recentActivity.map((row) => ({
        activity_at: row.activity_at,
        activity_type: row.activity_type,
        title: row.title,
        meta: row.meta,
      })),
      notifications: notifications.map((row) => ({
        notification_id: row.notification_id,
        notification_type: row.notification_type,
        message: row.message,
        sort_date: row.sort_date,
      })),
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
              COALESCE(SUM(price), 0) AS fuelCost,
              COALESCE(SUM(liters), 0) AS fuelLiters
       FROM fuel_details
       WHERE fuel_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 11 MONTH)
       GROUP BY DATE_FORMAT(fuel_date, '%Y-%m')
       ORDER BY month ASC`
    );

    const [monthlyMaintenanceCost] = await pool.query(
      `SELECT DATE_FORMAT(service_date, '%Y-%m') AS month,
              COALESCE(SUM(cost), 0) AS maintenanceCost
       FROM maintenance_records
       WHERE service_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 11 MONTH)
       GROUP BY DATE_FORMAT(service_date, '%Y-%m')
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
        fuelLiters: Number(row.fuelLiters || 0),
      })),
      monthlyMaintenanceCost: monthlyMaintenanceCost.map((row) => ({
        month: row.month,
        maintenanceCost: Number(row.maintenanceCost || 0),
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
      fuelByTruck: fuelByTruck.map((row) => ({
        truck_no: row.truck_no,
        total_liters: Number(row.total_liters || 0),
        total_cost: Number(row.total_cost || 0),
        refuels: Number(row.refuels || 0),
      })),
      monthlyTrend: monthlyTrend.map((row) => ({
        month: row.month,
        liters: Number(row.liters || 0),
        cost: Number(row.cost || 0),
      })),
    });
  } catch (err) {
    return next(err);
  }
}

async function getMaintenanceForecast(req, res, next) {
  try {
    const [forecasts] = await pool.query(
      `SELECT t.truck_id, t.truck_no,
              IFNULL(m.last_service_date, 'No Record') AS last_service,
              COUNT(tr.trip_id) AS trips_since_service
       FROM truck_details t
       LEFT JOIN (
           SELECT truck_id, MAX(service_date) AS last_service_date
           FROM maintenance_records
           GROUP BY truck_id
       ) m ON t.truck_id = m.truck_id
       LEFT JOIN trips tr ON t.truck_id = tr.truck_id AND (m.last_service_date IS NULL OR tr.trip_date > m.last_service_date)
       GROUP BY t.truck_id, t.truck_no, m.last_service_date
       ORDER BY trips_since_service DESC`
    );

    return res.json(forecasts.map((f) => ({
      truck_id: f.truck_id,
      truck_no: f.truck_no,
      last_service: f.last_service,
      trips_since_service: Number(f.trips_since_service),
    })));
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
  getMaintenanceForecast,
};
