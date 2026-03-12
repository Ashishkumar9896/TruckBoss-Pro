const pool = require("../config/db");

async function getTripProfitability(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const offset = (page - 1) * limit;

    // We do a complex query to calculate the exact profit for each trip
    // Profit = Revenue(amount) - (Toll + Misc) - (Fuel mapping) - (Driver Salary / 30)

    // First get the total count for pagination
    const [[countRow]] = await pool.query("SELECT COUNT(*) as count FROM trips");
    const totalRecords = countRow.count;

    const [rows] = await pool.query(`
      SELECT 
        tr.trip_id,
        tr.trip_date,
        tr.from_city,
        tr.to_city,
        t.truck_no,
        tr.truck_id,
        tr.driver_id,
        tr.customer_id,
        d.name AS driver_name,
        tr.amount AS revenue,
        tr.toll_amount,
        tr.misc_expenses,
        (IFNULL(d.salary, 0) / 30) AS daily_salary,
        (
          SELECT COALESCE(SUM(price), 0)
          FROM fuel_details f
          WHERE f.truck_id = tr.truck_id
            AND DATE(f.fuel_date) = DATE(tr.trip_date)
        ) AS fuel_cost
      FROM trips tr
      LEFT JOIN truck_details t ON tr.truck_id = t.truck_id
      LEFT JOIN driver_details d ON tr.driver_id = d.driver_id
      ORDER BY tr.trip_date DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    const profitabilityData = rows.map(r => {
      const revenue = Number(r.revenue);
      const tolls = Number(r.toll_amount);
      const misc = Number(r.misc_expenses);
      const salary = Number(r.daily_salary);
      const fuel = Number(r.fuel_cost);
      
      const totalExpenses = tolls + misc + salary + fuel;
      const netProfit = revenue - totalExpenses;

      return {
        trip_id: r.trip_id,
        trip_date: r.trip_date,
        from_city: r.from_city,
        to_city: r.to_city,
        truck_no: r.truck_no,
        truck_id: r.truck_id,
        driver_id: r.driver_id,
        customer_id: r.customer_id,
        driver_name: r.driver_name,
        revenue,
        expenses: {
          tolls,
          misc,
          daily_salary: Number(salary.toFixed(2)),
          fuel_cost: fuel,
          total: Number(totalExpenses.toFixed(2))
        },
        net_profit: Number(netProfit.toFixed(2))
      };
    });

    return res.json({
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      data: profitabilityData
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getTripProfitability
};
