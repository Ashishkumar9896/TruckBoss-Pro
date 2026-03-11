const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const pool = require("../config/db");

async function fetchTripReportRows() {
  const [rows] = await pool.query(
    `SELECT tr.trip_id,
            t.truck_no,
            d.name AS driver_name,
            tr.trip_date,
            NULL AS distance,
            COALESCE(fd.daily_fuel_cost, 0) AS fuel_cost,
            COALESCE(tr.amount, 0) AS revenue
     FROM trips tr
     LEFT JOIN truck_details t ON tr.truck_id = t.truck_id
     LEFT JOIN driver_details d ON tr.driver_id = d.driver_id
     LEFT JOIN (
       SELECT truck_id, fuel_date, SUM(price) AS daily_fuel_cost
       FROM fuel_details
       GROUP BY truck_id, fuel_date
     ) fd ON fd.truck_id = tr.truck_id AND fd.fuel_date = tr.trip_date
     ORDER BY tr.trip_date DESC, tr.trip_id DESC`
  );
  return rows;
}

async function fetchFuelReportRows() {
  const [rows] = await pool.query(
    `SELECT t.truck_no,
            f.liters AS fuel_amount,
            f.price AS fuel_cost,
            f.fuel_date
     FROM fuel_details f
     LEFT JOIN truck_details t ON f.truck_id = t.truck_id
     ORDER BY f.fuel_date DESC, f.fuel_id DESC`
  );
  return rows;
}

async function fetchMonthlyRevenueRows() {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(tr.trip_date, '%Y-%m') AS month,
            COUNT(*) AS trip_count,
            COALESCE(SUM(tr.amount), 0) AS total_revenue
     FROM trips tr
     GROUP BY DATE_FORMAT(tr.trip_date, '%Y-%m')
     ORDER BY month DESC`
  );
  return rows;
}

function writePdfHeader(doc, title) {
  doc.fontSize(16).text(title, { align: "center" });
  doc.moveDown();
  doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`);
  doc.moveDown();
}

function ensurePdfPage(doc, y, minBottom = 720) {
  if (y > minBottom) {
    doc.addPage();
    return 50;
  }
  return y;
}

function styleExcelHeader(worksheet) {
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E78" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 20;
}

function addTotalsRow(worksheet, labelColumnKey, totalsMap) {
  const totalRowData = { [labelColumnKey]: "TOTAL" };
  Object.keys(totalsMap).forEach((key) => {
    totalRowData[key] = totalsMap[key];
  });

  const totalRow = worksheet.addRow(totalRowData);
  totalRow.font = { bold: true };
  totalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2F0D9" },
  };
}

async function exportTripsPdf(req, res, next) {
  try {
    const rows = await fetchTripReportRows();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=trip-report.pdf");

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    doc.pipe(res);

    writePdfHeader(doc, "Trip Report");

    doc.fontSize(9).text("Trip ID", 40, doc.y);
    doc.text("Truck", 90, doc.y);
    doc.text("Driver", 180, doc.y);
    doc.text("Date", 290, doc.y);
    doc.text("Distance", 360, doc.y);
    doc.text("Fuel Cost", 430, doc.y);
    doc.text("Revenue", 510, doc.y);

    let y = doc.y + 14;
    rows.forEach((row) => {
      y = ensurePdfPage(doc, y);
      doc.fontSize(8).text(String(row.trip_id ?? "-"), 40, y);
      doc.text(String(row.truck_no ?? "-"), 90, y, { width: 80, ellipsis: true });
      doc.text(String(row.driver_name ?? "-"), 180, y, { width: 100, ellipsis: true });
      doc.text(String(row.trip_date ?? "-"), 290, y);
      doc.text(String(row.distance ?? "N/A"), 360, y);
      doc.text(String(row.fuel_cost ?? 0), 430, y);
      doc.text(String(row.revenue ?? 0), 510, y);
      y += 14;
    });

    doc.end();
  } catch (err) {
    next(err);
  }
}

async function exportTripsExcel(req, res, next) {
  try {
    const rows = await fetchTripReportRows();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Trip Report");

    worksheet.columns = [
      { header: "Trip ID", key: "trip_id", width: 12 },
      { header: "Truck Number", key: "truck_no", width: 18 },
      { header: "Driver Name", key: "driver_name", width: 22 },
      { header: "Trip Date", key: "trip_date", width: 14 },
      { header: "Distance", key: "distance", width: 14 },
      { header: "Fuel Cost", key: "fuel_cost", width: 14 },
      { header: "Revenue", key: "revenue", width: 14 },
    ];

    rows.forEach((row) => {
      worksheet.addRow({
        trip_id: row.trip_id,
        truck_no: row.truck_no || "",
        driver_name: row.driver_name || "",
        trip_date: row.trip_date,
        distance: row.distance || "N/A",
        fuel_cost: row.fuel_cost,
        revenue: row.revenue,
      });
    });

    styleExcelHeader(worksheet);

    const totalFuelCost = rows.reduce((sum, row) => sum + Number(row.fuel_cost || 0), 0);
    const totalRevenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
    addTotalsRow(worksheet, "driver_name", {
      fuel_cost: totalFuelCost,
      revenue: totalRevenue,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=trip-report.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

async function exportFuelExcel(req, res, next) {
  try {
    const rows = await fetchFuelReportRows();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Fuel Report");

    worksheet.columns = [
      { header: "Truck Number", key: "truck_no", width: 18 },
      { header: "Fuel Amount", key: "fuel_amount", width: 14 },
      { header: "Fuel Cost", key: "fuel_cost", width: 14 },
      { header: "Date", key: "fuel_date", width: 14 },
    ];

    rows.forEach((row) => {
      worksheet.addRow({
        truck_no: row.truck_no || "",
        fuel_amount: row.fuel_amount,
        fuel_cost: row.fuel_cost,
        fuel_date: row.fuel_date,
      });
    });

    styleExcelHeader(worksheet);

    const totalFuelAmount = rows.reduce((sum, row) => sum + Number(row.fuel_amount || 0), 0);
    const totalFuelCost = rows.reduce((sum, row) => sum + Number(row.fuel_cost || 0), 0);
    addTotalsRow(worksheet, "truck_no", {
      fuel_amount: totalFuelAmount,
      fuel_cost: totalFuelCost,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=fuel-report.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

async function exportMonthlyRevenueExcel(req, res, next) {
  try {
    const rows = await fetchMonthlyRevenueRows();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Monthly Revenue");

    worksheet.columns = [
      { header: "Month", key: "month", width: 12 },
      { header: "Trip Count", key: "trip_count", width: 14 },
      { header: "Total Revenue", key: "total_revenue", width: 16 },
    ];

    rows.forEach((row) => worksheet.addRow(row));

    styleExcelHeader(worksheet);

    const totalTripCount = rows.reduce((sum, row) => sum + Number(row.trip_count || 0), 0);
    const totalRevenue = rows.reduce((sum, row) => sum + Number(row.total_revenue || 0), 0);
    addTotalsRow(worksheet, "month", {
      trip_count: totalTripCount,
      total_revenue: totalRevenue,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=monthly-revenue-report.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

async function exportMonthlyRevenuePdf(req, res, next) {
  try {
    const rows = await fetchMonthlyRevenueRows();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=monthly-revenue-report.pdf");

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    doc.pipe(res);

    writePdfHeader(doc, "Monthly Revenue Report");

    doc.fontSize(10).text("Month", 50, doc.y);
    doc.text("Trip Count", 220, doc.y);
    doc.text("Total Revenue", 360, doc.y);

    let y = doc.y + 16;
    rows.forEach((row) => {
      y = ensurePdfPage(doc, y);
      doc.fontSize(9).text(String(row.month ?? "-"), 50, y);
      doc.text(String(row.trip_count ?? 0), 220, y);
      doc.text(String(row.total_revenue ?? 0), 360, y);
      y += 15;
    });

    doc.end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  exportTripsPdf,
  exportTripsExcel,
  exportFuelExcel,
  exportMonthlyRevenueExcel,
  exportMonthlyRevenuePdf,
};
