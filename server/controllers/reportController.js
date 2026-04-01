const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const pool = require("../config/db");

/* ── Data fetchers ── */

async function fetchTripReportRows(filters = {}) {
  let whereClause = " WHERE 1=1";
  const values = [];

  if (filters.driver) {
    whereClause += " AND tr.driver_id = ?";
    values.push(filters.driver);
  }
  if (filters.truck) {
    whereClause += " AND t.truck_no = ?";
    values.push(filters.truck);
  }
  if (filters.customer) {
    whereClause += " AND tr.customer_id = ?";
    values.push(filters.customer);
  }
  if (filters.date) {
    whereClause += " AND DATE(tr.trip_date) = ?";
    values.push(filters.date);
  }
  if (filters.status) {
    whereClause += " AND tr.status = ?";
    values.push(filters.status);
  }

  const [rows] = await pool.query(
    `SELECT tr.trip_id,
            tr.manual_customer_name,
            t.truck_no,
            d.name AS driver_name,
            COALESCE(c.name, tr.manual_customer_name) AS customer_name,
            tr.material_type,
            tr.quantity,
            tr.trip_date,
            tr.status,
            COALESCE(tr.amount, 0) AS amount,
            COALESCE(fd.daily_fuel_cost, 0) AS fuel_cost,
            COALESCE(tr.amount,0) AS total_billed
     FROM trips tr
     LEFT JOIN truck_details t ON tr.truck_id = t.truck_id
     LEFT JOIN driver_details d ON tr.driver_id = d.driver_id
     LEFT JOIN customers c ON tr.customer_id = c.customer_id
     LEFT JOIN (
       SELECT truck_id, DATE(fuel_date) AS date_only, SUM(price) AS daily_fuel_cost
       FROM fuel_details
       GROUP BY truck_id, DATE(fuel_date)
     ) fd ON fd.truck_id = tr.truck_id AND fd.date_only = DATE(tr.trip_date)
     ${whereClause}
     ORDER BY tr.trip_date DESC, tr.trip_id DESC`,
    values
  );
  return rows;
}

async function fetchFuelReportRows(filters = {}) {
  let whereClause = " WHERE 1=1";
  const values = [];

  if (filters.truckStr) {
    whereClause += " AND t.truck_no LIKE ?";
    values.push(`%${filters.truckStr}%`);
  }
  if (filters.driver) {
    whereClause += " AND f.driver_id = ?";
    values.push(filters.driver);
  }
  if (filters.date) {
    whereClause += " AND DATE(f.fuel_date) = ?";
    values.push(filters.date);
  }

  const [rows] = await pool.query(
    `SELECT t.truck_no,
            d.name AS driver_name,
            f.liters AS fuel_amount,
            f.price AS fuel_cost,
            f.fuel_date
     FROM fuel_details f
     LEFT JOIN truck_details t ON f.truck_id = t.truck_id
     LEFT JOIN driver_details d ON f.driver_id = d.driver_id
     ${whereClause}
     ORDER BY f.fuel_date DESC, f.fuel_id DESC`,
    values
  );
  return rows;
}

async function fetchMonthlyRevenueRows(filters = {}) {
  let whereClause = " WHERE 1=1";
  const values = [];

  if (filters.driver) {
    whereClause += " AND tr.driver_id = ?";
    values.push(filters.driver);
  }
  if (filters.truck) {
    whereClause += " AND t.truck_no = ?";
    values.push(filters.truck);
  }
  if (filters.customer) {
    whereClause += " AND tr.customer_id = ?";
    values.push(filters.customer);
  }
  if (filters.date) {
    whereClause += " AND DATE(tr.trip_date) = ?";
    values.push(filters.date);
  }
  if (filters.status) {
    whereClause += " AND tr.status = ?";
    values.push(filters.status);
  }

  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(tr.trip_date, '%Y-%m') AS month,
            COUNT(*) AS trip_count,
            COALESCE(SUM(COALESCE(tr.amount,0)), 0) AS total_revenue
     FROM trips tr
     LEFT JOIN truck_details t ON tr.truck_id = t.truck_id
     LEFT JOIN driver_details d ON tr.driver_id = d.driver_id
     ${whereClause}
     GROUP BY DATE_FORMAT(tr.trip_date, '%Y-%m')
     ORDER BY month DESC`,
    values
  );
  return rows;
}

async function fetchDailyRevenueRows(filters = {}) {
  let whereClause = " WHERE 1=1";
  const values = [];

  if (filters.driver) {
    whereClause += " AND tr.driver_id = ?";
    values.push(filters.driver);
  }
  if (filters.truck) {
    whereClause += " AND t.truck_no = ?";
    values.push(filters.truck);
  }
  if (filters.customer) {
    whereClause += " AND tr.customer_id = ?";
    values.push(filters.customer);
  }
  if (filters.date) {
    whereClause += " AND DATE(tr.trip_date) = ?";
    values.push(filters.date);
  }
  if (filters.status) {
    whereClause += " AND tr.status = ?";
    values.push(filters.status);
  }

  const [rows] = await pool.query(
    `SELECT
       DATE(CONVERT_TZ(COALESCE(tr.trip_date, NOW()), '+00:00', '+05:30')) AS trip_day,
       COUNT(*) AS trip_count,
       COALESCE(SUM(COALESCE(tr.amount,0)), 0) AS total_revenue
     FROM trips tr
     LEFT JOIN truck_details t ON tr.truck_id = t.truck_id
     LEFT JOIN driver_details d ON tr.driver_id = d.driver_id
     ${whereClause}
     GROUP BY DATE(CONVERT_TZ(COALESCE(tr.trip_date, NOW()), '+00:00', '+05:30'))
     ORDER BY trip_day DESC
     LIMIT 90`,
    values
  );
  return rows;
}

/* ── Formatting helpers ── */

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Table cell date: 10/03/2026
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// Header date: 12 Mar 2026
function fmtDateMedium(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

// Excel date: 2026-03-10
function fmtDateShort(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return d.toISOString().split("T")[0];
}

// Indian Rupee: Rs.20,00,000
function fmtINR(v) {
  const n = Number(v || 0);
  return "Rs." + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

// Month label: Mar 2026
function fmtMonth(v) {
  if (!v) return "-";
  const parts = String(v).split("-");
  if (parts.length !== 2) return String(v);
  const mi = Number(parts[1]) - 1;
  if (mi < 0 || mi > 11) return String(v);
  return `${MONTH_SHORT[mi]} ${parts[0]}`;
}

/* ── PDF constants ── */

const PDF_MARGIN    = 40;
const PAGE_WIDTH    = 841.89; // A4 Landscape
const PAGE_HEIGHT   = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - PDF_MARGIN * 2;   // 761.89 pt
const FOOTER_TEXT   = "Generated by Bhilal Trucks Fleet Management System | © " + new Date().getFullYear() + " Bhilal Trucks. All Rights Reserved.";

const COLORS = {
  primary:      "#1E3A8A",      // Deep modern blue
  headerBg:     "#1E3A8A",      
  headerText:   "#FFFFFF",
  altRow:       "#F8FAFC",      // Very clean light slate
  white:        "#FFFFFF",
  text:         "#1F2937",      // Darker, sharper text
  lightText:    "#4B5563",      // Softer gray for subtitles
  divider:      "#D1D5DB",
  rowBorder:    "#E5E7EB",      // Subtle row borders
  summaryBg:    "#EFF6FF",      // Soft blue tint for summary cards
  summaryBorder:"#BFDBFE",
  bannerSub:    "#93C5FD",      // Bright blue for banner subtitle
  colDivider:   "#3B82F6",      // Noticeable but subtle column divider
};

/* ── PDF helpers ── */

function addFooter(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    
    // Diagonal Watermark
    doc.save()
       .translate(PAGE_WIDTH / 2, PAGE_HEIGHT / 2)
       .rotate(-30)
       .font("Helvetica-Bold")
       .fontSize(70)
       .fillColor("#CBD5E1")    // Slate 300 (very subtle gray)
       .fillOpacity(0.18)       // Very transparent
       .text("B H I L A L   T R U C K S", -400, -35, { width: 800, align: "center" })
       .restore();

    doc
      .fontSize(8.5)
      .fillColor(COLORS.lightText)
      .text(FOOTER_TEXT, PDF_MARGIN, PAGE_HEIGHT - 35, { width: CONTENT_WIDTH, align: "center" });
    doc.text(`Page ${i + 1} of ${range.count}`, PDF_MARGIN, PAGE_HEIGHT - 22, {
      width: CONTENT_WIDTH,
      align: "center",
    });
  }
}

function writePdfHeader(doc, reportName) {
  const startY = PDF_MARGIN;
  const bannerH = 75;

  // Navy banner
  doc.rect(PDF_MARGIN, startY, CONTENT_WIDTH, bannerH).fill(COLORS.headerBg);

  // Company name (left)
  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor(COLORS.headerText)
    .text("Bhilal Trucks", PDF_MARGIN + 18, startY + 16, {
      width: CONTENT_WIDTH - 36,
      align: "left",
    });

  // Subtitle (left)
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor(COLORS.bannerSub)
    .text("Fleet Management System", PDF_MARGIN + 18, startY + 44, {
      width: CONTENT_WIDTH - 36,
      align: "left",
    });

  // Generated date (right)
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(COLORS.bannerSub)
    .text(`Generated: ${fmtDateMedium(new Date())}`, PDF_MARGIN + 18, startY + 16, {
      width: CONTENT_WIDTH - 36,
      align: "right",
    });

  // Advance cursor past banner
  doc.y = startY + bannerH + 14;

  // Report name
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(COLORS.primary)
    .text(reportName, PDF_MARGIN, doc.y, { width: CONTENT_WIDTH, align: "center" });

  // Underline
  doc.moveDown(0.25);
  const lineY = doc.y;
  doc
    .moveTo(PDF_MARGIN, lineY)
    .lineTo(PAGE_WIDTH - PDF_MARGIN, lineY)
    .strokeColor(COLORS.primary)
    .lineWidth(1)
    .stroke();

  doc.y = lineY + 14;
}

function writeSummarySection(doc, items) {
  // Section heading
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(COLORS.primary)
    .text("REPORT SUMMARY", PDF_MARGIN, doc.y, { width: CONTENT_WIDTH });

  doc.moveDown(0.3);

  // Short accent line
  const accentY = doc.y;
  doc
    .moveTo(PDF_MARGIN, accentY)
    .lineTo(PDF_MARGIN + 100, accentY)
    .strokeColor(COLORS.primary)
    .lineWidth(2)
    .stroke();

  doc.y = accentY + 10;

  // Card grid: 2 columns
  const GAP    = 10;
  const COLS   = 2;
  const CARD_W = (CONTENT_WIDTH - GAP * (COLS - 1)) / COLS;
  const CARD_H = 46;
  const baseY  = doc.y;

  items.forEach((item, idx) => {
    const col   = idx % COLS;
    const row   = Math.floor(idx / COLS);
    const cardX = PDF_MARGIN + col * (CARD_W + GAP);
    const cardY = baseY + row * (CARD_H + 8);

    // Card background + border
    doc
      .roundedRect(cardX, cardY, CARD_W, CARD_H, 4)
      .fillAndStroke(COLORS.summaryBg, COLORS.summaryBorder);

    // Left accent bar
    doc.rect(cardX, cardY, 3, CARD_H).fill(COLORS.primary);

    // Label
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLORS.lightText)
      .text(item.label, cardX + 12, cardY + 8, { width: CARD_W - 16 });

    // Value
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(COLORS.primary)
      .text(item.value, cardX + 12, cardY + 22, { width: CARD_W - 16 });
  });

  const numRows = Math.ceil(items.length / COLS);
  doc.y = baseY + numRows * (CARD_H + 8) + 12;
  doc.font("Helvetica");
}

/* ── Table helpers ── */

function drawTableHeader(doc, columns, y) {
  const ROW_H = 30;

  doc.rect(PDF_MARGIN, y, CONTENT_WIDTH, ROW_H).fill(COLORS.headerBg);

  // Subtle vertical dividers
  columns.slice(0, -1).forEach((col) => {
    const divX = col.x + col.width + (col.gap || 0) / 2;
    doc
      .moveTo(divX, y + 6)
      .lineTo(divX, y + ROW_H - 6)
      .strokeColor(COLORS.colDivider)
      .lineWidth(0.5)
      .stroke();
  });

  // Header labels — 4pt inset
  columns.forEach((col) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .fillColor(COLORS.headerText)
      .text(col.label, col.x + 4, y + 10, {
        width: col.width - 4,
        align: col.align || "left",
      });
  });

  doc.font("Helvetica");
  return y + ROW_H;
}

function drawTableRow(doc, columns, rowData, y, isAlt) {
  const ROW_H = 26;

  doc
    .rect(PDF_MARGIN, y, CONTENT_WIDTH, ROW_H)
    .fill(isAlt ? COLORS.altRow : COLORS.white);

  doc
    .moveTo(PDF_MARGIN, y + ROW_H)
    .lineTo(PAGE_WIDTH - PDF_MARGIN, y + ROW_H)
    .strokeColor(COLORS.rowBorder)
    .lineWidth(0.3)
    .stroke();

  columns.forEach((col) => {
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(COLORS.text)
      .text(String(rowData[col.key] ?? "-"), col.x + 4, y + 8, {
        width: col.width - 4,
        align: col.align || "left",
        ellipsis: true,
        lineBreak: false,
      });
  });

  return y + ROW_H;
}

function ensurePdfPage(doc, y, columns, minBottom = PAGE_HEIGHT - 60) {
  if (y > minBottom) {
    doc.addPage({ margin: PDF_MARGIN, size: "A4", layout: "landscape" });
    return drawTableHeader(doc, columns, PDF_MARGIN);
  }
  return y;
}

/* ── Excel helpers ── */

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

/* ══════════════════════════════════════════
   TRIPS PDF
   ══════════════════════════════════════════ */

async function exportTripsPdf(req, res, next) {
  try {
    const filters = {
      driver: req.query.driver ? String(req.query.driver).trim() : "",
      truck: req.query.truck ? String(req.query.truck).trim() : "",
      customer: req.query.customer ? String(req.query.customer).trim() : "",
      date: req.query.date ? String(req.query.date).trim() : "",
      status: req.query.status ? String(req.query.status).trim() : "",
    };
    const rows = await fetchTripReportRows(filters);

    const totalTrips  = rows.length;
    const totalRevenue  = rows.reduce((s, r) => s + Number(r.total_billed || 0), 0);
    const totalFuelCost = rows.reduce((s, r) => s + Number(r.fuel_cost || 0), 0);
    const avgRevenue  = totalTrips ? totalRevenue / totalTrips : 0;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=Bhilal-Trucks-trips-report.pdf");

    const doc = new PDFDocument({ margin: PDF_MARGIN, size: "A4", layout: "landscape", bufferPages: true });
    doc.pipe(res);

    writePdfHeader(doc, "Trips Report");

    writeSummarySection(doc, [
      { label: "Total Trips",              value: String(totalTrips) },
      { label: "Total Billed",             value: fmtINR(totalRevenue) },
      { label: "Total Fuel Cost",          value: fmtINR(totalFuelCost) },
      { label: "Average Billed per Trip",  value: fmtINR(avgRevenue) },
    ]);

    // Divider before table
    doc
      .moveTo(PDF_MARGIN, doc.y)
      .lineTo(PAGE_WIDTH - PDF_MARGIN, doc.y)
      .strokeColor(COLORS.divider)
      .lineWidth(0.5)
      .stroke();
    doc.moveDown(0.5);

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(COLORS.primary)
      .text("Trip Details", PDF_MARGIN, doc.y);
    doc.font("Helvetica").moveDown(0.4);

    const GAP = 5;
    let currentX = PDF_MARGIN;
    const columns = [
      { label: "ID",       key: "trip_id",       width: 28,  align: "left" },
      { label: "Date",     key: "trip_date",     width: 52,  align: "left" },
      { label: "Truck",    key: "truck_no",      width: 55,  align: "left" },
      { label: "Driver",   key: "driver_name",   width: 80,  align: "left" },
      { label: "Customer", key: "customer_name", width: 90,  align: "left" },
      { label: "Material", key: "material_type", width: 90,  align: "left" },
      { label: "Qty",      key: "quantity",      width: 35,  align: "center" },
      { label: "Fuel",     key: "fuel_cost",     width: 65,  align: "right" },
      { label: "Billed",   key: "total_billed",  width: 70,  align: "right" },
      { label: "Status",   key: "status",        width: 50,  align: "center" },
    ].map(col => {
      col.x = currentX;
      col.gap = GAP;
      currentX += col.width + GAP;
      return col;
    });

    let y = drawTableHeader(doc, columns, doc.y);

    rows.forEach((row, i) => {
      y = ensurePdfPage(doc, y, columns);

      y = drawTableRow(
        doc,
        columns,
        {
          trip_id:        row.trip_id,
          trip_date:      fmtDate(row.trip_date),
          truck_no:       row.truck_no    || "-",
          driver_name:    row.driver_name ? String(row.driver_name).substring(0,12) : "-",
          customer_name:  row.customer_name ? String(row.customer_name).substring(0,14) : "-",
          material_type:  row.material_type ? String(row.material_type).substring(0,12) : "-",
          quantity:       row.quantity ? `${row.quantity}` : "-",
          fuel_cost:      fmtINR(row.fuel_cost),
          total_billed:   fmtINR(row.total_billed),
          status:         row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1) : "-",
        },
        y,
        i % 2 === 1
      );
    });

    // Bottom border
    doc
      .moveTo(PDF_MARGIN, y)
      .lineTo(PAGE_WIDTH - PDF_MARGIN, y)
      .strokeColor(COLORS.divider)
      .lineWidth(0.5)
      .stroke();

    addFooter(doc);
    doc.end();
  } catch (err) {
    next(err);
  }
}

/* ══════════════════════════════════════════
   TRIPS EXCEL
   ══════════════════════════════════════════ */

async function exportTripsExcel(req, res, next) {
  try {
    const filters = {
      driver: req.query.driver ? String(req.query.driver).trim() : "",
      truck: req.query.truck ? String(req.query.truck).trim() : "",
      customer: req.query.customer ? String(req.query.customer).trim() : "",
      date: req.query.date ? String(req.query.date).trim() : "",
      status: req.query.status ? String(req.query.status).trim() : "",
    };
    const rows = await fetchTripReportRows(filters);

    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Trip Report");

    worksheet.columns = [
      { header: "Trip ID",      key: "trip_id",     width: 12 },
      { header: "Trip Date",    key: "trip_date",   width: 14 },
      { header: "Truck Number", key: "truck_no",    width: 18 },
      { header: "Driver Name",  key: "driver_name", width: 22 },
      { header: "Customer Name",key: "customer_name",width: 25 },
      { header: "Material",     key: "material_type",width: 18 },
      { header: "Quantity",     key: "quantity",    width: 12 },
      { header: "Fuel Cost",    key: "fuel_cost",   width: 14 },
      { header: "Total Billed", key: "total_billed",width: 15 },
    ];

    rows.forEach((row) => {
      worksheet.addRow({
        trip_id:       row.trip_id,
        trip_date:     fmtDateShort(row.trip_date),
        truck_no:      row.truck_no      || "",
        driver_name:   row.driver_name   || "",
        customer_name: row.customer_name || "",
        material_type: row.material_type || "",
        quantity:      row.quantity      || 0,
        fuel_cost:     Number(row.fuel_cost)    || 0,
        total_billed:  Number(row.total_billed) || 0,
      });
    });

    styleExcelHeader(worksheet);

    const totalFuelCost = rows.reduce((sum, r) => sum + Number(r.fuel_cost || 0), 0);
    const totalRevenue  = rows.reduce((sum, r) => sum + Number(r.total_billed   || 0), 0);
    addTotalsRow(worksheet, "driver_name", { fuel_cost: totalFuelCost, total_billed: totalRevenue });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=Bhilal-Trucks-trips-report.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

/* ══════════════════════════════════════════
   FUEL EXCEL
   ══════════════════════════════════════════ */

async function exportFuelExcel(req, res, next) {
  try {
    const filters = {
      truckStr: req.query.truckStr ? String(req.query.truckStr).trim() : "",
      driver: req.query.driver ? String(req.query.driver).trim() : "",
      date: req.query.date ? String(req.query.date).trim() : "",
    };
    const rows = await fetchFuelReportRows(filters);

    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Fuel Report");

    worksheet.columns = [
      { header: "Truck Number", key: "truck_no",    width: 18 },
      { header: "Driver Name",  key: "driver_name", width: 22 },
      { header: "Fuel Amount",  key: "fuel_amount", width: 14 },
      { header: "Fuel Cost",    key: "fuel_cost",   width: 14 },
      { header: "Date",         key: "fuel_date",   width: 14 },
    ];

    rows.forEach((row) => {
      worksheet.addRow({
        truck_no:    row.truck_no || "",
        driver_name: row.driver_name || "",
        fuel_amount: row.fuel_amount,
        fuel_cost:   row.fuel_cost,
        fuel_date:   fmtDateShort(row.fuel_date),
      });
    });

    styleExcelHeader(worksheet);

    const totalFuelAmount = rows.reduce((sum, r) => sum + Number(r.fuel_amount || 0), 0);
    const totalFuelCost   = rows.reduce((sum, r) => sum + Number(r.fuel_cost   || 0), 0);
    addTotalsRow(worksheet, "truck_no", { fuel_amount: totalFuelAmount, fuel_cost: totalFuelCost });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=Bhilal-Trucks-fuel-report.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

/* ══════════════════════════════════════════
   MONTHLY REVENUE EXCEL
   ══════════════════════════════════════════ */

async function exportMonthlyRevenueExcel(req, res, next) {
  try {
    const filters = {
      driver: req.query.driver ? String(req.query.driver).trim() : "",
      truck: req.query.truck ? String(req.query.truck).trim() : "",
      customer: req.query.customer ? String(req.query.customer).trim() : "",
      date: req.query.date ? String(req.query.date).trim() : "",
      status: req.query.status ? String(req.query.status).trim() : "",
    };
    const rows = await fetchMonthlyRevenueRows(filters);

    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Monthly Revenue");

    worksheet.columns = [
      { header: "Month",         key: "month",         width: 12 },
      { header: "Trip Count",    key: "trip_count",    width: 14 },
      { header: "Total Billed",  key: "total_revenue", width: 16 },
    ];

    rows.forEach((row) => worksheet.addRow(row));
    styleExcelHeader(worksheet);

    const totalTripCount = rows.reduce((sum, r) => sum + Number(r.trip_count    || 0), 0);
    const totalRevenue   = rows.reduce((sum, r) => sum + Number(r.total_revenue || 0), 0);
    addTotalsRow(worksheet, "month", { trip_count: totalTripCount, total_revenue: totalRevenue });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=Bhilal-Trucks-monthly-revenue.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

/* ══════════════════════════════════════════
   MONTHLY REVENUE PDF
   ══════════════════════════════════════════ */

async function exportMonthlyRevenuePdf(req, res, next) {
  try {
    const filters = {
      driver: req.query.driver ? String(req.query.driver).trim() : "",
      truck: req.query.truck ? String(req.query.truck).trim() : "",
      customer: req.query.customer ? String(req.query.customer).trim() : "",
      date: req.query.date ? String(req.query.date).trim() : "",
      status: req.query.status ? String(req.query.status).trim() : "",
    };
    const rows = await fetchMonthlyRevenueRows(filters);

    const totalTrips        = rows.reduce((s, r) => s + Number(r.trip_count    || 0), 0);
    const totalRevenue      = rows.reduce((s, r) => s + Number(r.total_revenue || 0), 0);
    const avgRevenuePerMonth = rows.length ? totalRevenue / rows.length : 0;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=Bhilal-Trucks-monthly-revenue.pdf");

    const doc = new PDFDocument({ margin: PDF_MARGIN, size: "A4", layout: "landscape", bufferPages: true });
    doc.pipe(res);

    writePdfHeader(doc, "Monthly Revenue Report");

    writeSummarySection(doc, [
      { label: "Months Covered",           value: String(rows.length) },
      { label: "Total Trips",              value: String(totalTrips) },
      { label: "Total Billed",             value: fmtINR(totalRevenue) },
      { label: "Avg Billed per Month",     value: fmtINR(avgRevenuePerMonth) },
    ]);

    doc
      .moveTo(PDF_MARGIN, doc.y)
      .lineTo(PAGE_WIDTH - PDF_MARGIN, doc.y)
      .strokeColor(COLORS.divider)
      .lineWidth(0.5)
      .stroke();
    doc.moveDown(0.5);

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(COLORS.primary)
      .text("Billed by Month", PDF_MARGIN, doc.y);
    doc.font("Helvetica").moveDown(0.4);

    // Monthly revenue columns: Month | Trip Count | Total Billed
    // Total Width: 761
    const GAP = 10;
    const columns = [
      { label: "Month",         key: "month",         x: PDF_MARGIN,                    width: 200, gap: GAP, align: "left"   },
      { label: "Trip Count",    key: "trip_count",    x: PDF_MARGIN + 200 + GAP,        width: 150, gap: GAP, align: "center" },
      { label: "Total Billed",  key: "total_revenue", x: PDF_MARGIN + 200 + GAP + 150 + GAP, width: 391, gap: 0, align: "right" },
    ];

    let y = drawTableHeader(doc, columns, doc.y);

    rows.forEach((row, i) => {
      y = ensurePdfPage(doc, y, columns);
      y = drawTableRow(
        doc,
        columns,
        {
          month:         fmtMonth(row.month),
          trip_count:    String(row.trip_count ?? 0),
          total_revenue: fmtINR(row.total_revenue),
        },
        y,
        i % 2 === 1
      );
    });

    doc
      .moveTo(PDF_MARGIN, y)
      .lineTo(PAGE_WIDTH - PDF_MARGIN, y)
      .strokeColor(COLORS.divider)
      .lineWidth(0.5)
      .stroke();

    addFooter(doc);
    doc.end();
  } catch (err) {
    next(err);
  }
}

/* ══════════════════════════════════════════
   DAILY REVENUE EXCEL
   ══════════════════════════════════════════ */

async function exportDailyRevenueExcel(req, res, next) {
  try {
    const filters = {
      driver: req.query.driver ? String(req.query.driver).trim() : "",
      truck: req.query.truck ? String(req.query.truck).trim() : "",
      customer: req.query.customer ? String(req.query.customer).trim() : "",
      date: req.query.date ? String(req.query.date).trim() : "",
      status: req.query.status ? String(req.query.status).trim() : "",
    };
    const rows = await fetchDailyRevenueRows(filters);

    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Daily Revenue");

    worksheet.columns = [
      { header: "Date",          key: "trip_day",     width: 14 },
      { header: "Trip Count",    key: "trip_count",   width: 14 },
      { header: "Total Billed",  key: "total_revenue", width: 16 },
    ];

    rows.forEach((row) => worksheet.addRow({
      trip_day:     fmtDateShort(row.trip_day),
      trip_count:   row.trip_count,
      total_revenue: row.total_revenue,
    }));
    styleExcelHeader(worksheet);

    const totalTripCount = rows.reduce((sum, r) => sum + Number(r.trip_count   || 0), 0);
    const totalRevenue   = rows.reduce((sum, r) => sum + Number(r.total_revenue || 0), 0);
    addTotalsRow(worksheet, "trip_day", { trip_count: totalTripCount, total_revenue: totalRevenue });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=Bhilal-Trucks-daily-revenue.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

/* ══════════════════════════════════════════
   DAILY REVENUE PDF
   ══════════════════════════════════════════ */

async function exportDailyRevenuePdf(req, res, next) {
  try {
    const filters = {
      driver: req.query.driver ? String(req.query.driver).trim() : "",
      truck: req.query.truck ? String(req.query.truck).trim() : "",
      customer: req.query.customer ? String(req.query.customer).trim() : "",
      date: req.query.date ? String(req.query.date).trim() : "",
      status: req.query.status ? String(req.query.status).trim() : "",
    };
    const rows = await fetchDailyRevenueRows(filters);

    const totalTrips        = rows.reduce((s, r) => s + Number(r.trip_count    || 0), 0);
    const totalRevenue      = rows.reduce((s, r) => s + Number(r.total_revenue || 0), 0);
    const avgRevenuePerDay  = rows.length ? totalRevenue / rows.length : 0;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=Bhilal-Trucks-daily-revenue.pdf");

    const doc = new PDFDocument({ margin: PDF_MARGIN, size: "A4", layout: "landscape", bufferPages: true });
    doc.pipe(res);

    writePdfHeader(doc, "Daily Revenue Report");

    writeSummarySection(doc, [
      { label: "Days Covered",           value: String(rows.length) },
      { label: "Total Trips",            value: String(totalTrips) },
      { label: "Total Billed",           value: fmtINR(totalRevenue) },
      { label: "Avg Billed per Day",     value: fmtINR(avgRevenuePerDay) },
    ]);

    doc
      .moveTo(PDF_MARGIN, doc.y)
      .lineTo(PAGE_WIDTH - PDF_MARGIN, doc.y)
      .strokeColor(COLORS.divider)
      .lineWidth(0.5)
      .stroke();
    doc.moveDown(0.5);

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(COLORS.primary)
      .text("Billed by Day (Last 90 Days)", PDF_MARGIN, doc.y);
    doc.font("Helvetica").moveDown(0.4);

    const GAP = 10;
    const columns = [
      { label: "Date",          key: "trip_day",     x: PDF_MARGIN,                    width: 200, gap: GAP, align: "left"   },
      { label: "Trip Count",    key: "trip_count",   x: PDF_MARGIN + 200 + GAP,        width: 150, gap: GAP, align: "center" },
      { label: "Total Billed",  key: "total_revenue", x: PDF_MARGIN + 200 + GAP + 150 + GAP, width: 391, gap: 0, align: "right" },
    ];

    let y = drawTableHeader(doc, columns, doc.y);

    rows.forEach((row, i) => {
      y = ensurePdfPage(doc, y, columns);
      y = drawTableRow(
        doc,
        columns,
        {
          trip_day:     fmtDate(row.trip_day),
          trip_count:   String(row.trip_count ?? 0),
          total_revenue: fmtINR(row.total_revenue),
        },
        y,
        i % 2 === 1
      );
    });

    doc
      .moveTo(PDF_MARGIN, y)
      .lineTo(PAGE_WIDTH - PDF_MARGIN, y)
      .strokeColor(COLORS.divider)
      .lineWidth(0.5)
      .stroke();

    addFooter(doc);
    doc.end();
  } catch (err) {
    next(err);
  }
}

async function getCustomerOutstandingReport(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT customer_id, name, phone_no, amount_paid, balance AS total_billed,
              GREATEST(balance - amount_paid, 0) AS pending_due,
              due_date, follow_up_notes
       FROM customers
       ORDER BY pending_due DESC, name ASC`
    );
    return res.json(rows.map((row) => ({
      ...row,
      amount_paid: Number(row.amount_paid || 0),
      total_billed: Number(row.total_billed || 0),
      pending_due: Number(row.pending_due || 0),
    })));
  } catch (err) {
    return next(err);
  }
}

async function getCustomerLedgerReport(req, res, next) {
  try {
    const customerId = req.query.customer_id;
    let whereClause = "";
    const params = [];
    if (customerId) {
      whereClause = "WHERE c.customer_id = ?";
      params.push(customerId);
    }

    const [rows] = await pool.query(
      `SELECT c.customer_id, c.name,
              COUNT(DISTINCT tr.trip_id) AS total_bills,
              COUNT(DISTINCT tx.transaction_id) AS total_payments,
              COALESCE(SUM(DISTINCT 0 + c.balance), c.balance) AS total_billed,
              c.amount_paid AS total_received,
              GREATEST(c.balance - c.amount_paid, 0) AS current_due
       FROM customers c
       LEFT JOIN trips tr ON tr.customer_id = c.customer_id
       LEFT JOIN customer_transactions tx ON tx.customer_id = c.customer_id
       ${whereClause}
       GROUP BY c.customer_id, c.name, c.balance, c.amount_paid
       ORDER BY c.name ASC`,
      params
    );
    return res.json(rows.map((row) => ({
      ...row,
      total_bills: Number(row.total_bills || 0),
      total_payments: Number(row.total_payments || 0),
      total_billed: Number(row.total_billed || 0),
      total_received: Number(row.total_received || 0),
      current_due: Number(row.current_due || 0),
    })));
  } catch (err) {
    return next(err);
  }
}

async function getDailyCollectionReport(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT payment_date, COUNT(*) AS transaction_count, COALESCE(SUM(amount), 0) AS total_collection
       FROM customer_transactions
       GROUP BY payment_date
       ORDER BY payment_date DESC
       LIMIT 90`
    );
    return res.json(rows.map((row) => ({
      payment_date: row.payment_date,
      transaction_count: Number(row.transaction_count || 0),
      total_collection: Number(row.total_collection || 0),
    })));
  } catch (err) {
    return next(err);
  }
}

async function getMonthlyCollectionReport(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(payment_date, '%Y-%m') AS month,
              COUNT(*) AS transaction_count,
              COALESCE(SUM(amount), 0) AS total_collection
       FROM customer_transactions
       GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
       ORDER BY month DESC`
    );
    return res.json(rows.map((row) => ({
      month: row.month,
      transaction_count: Number(row.transaction_count || 0),
      total_collection: Number(row.total_collection || 0),
    })));
  } catch (err) {
    return next(err);
  }
}

async function getTruckProfitabilityReport(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT t.truck_id, t.truck_no,
              COUNT(tr.trip_id) AS trip_count,
              COALESCE(SUM(tr.amount), 0) AS total_billed,
              
              COALESCE(SUM(fd.daily_fuel_cost), 0) AS fuel_cost,
              COALESCE(SUM(tr.amount), 0)
                - COALESCE(SUM(fd.daily_fuel_cost), 0) AS net_profit
       FROM truck_details t
       LEFT JOIN (
         SELECT * FROM trips
       ) tr ON tr.truck_id = t.truck_id
       LEFT JOIN (
         SELECT truck_id, DATE(fuel_date) AS fuel_day, SUM(price) AS daily_fuel_cost
         FROM fuel_details
         GROUP BY truck_id, DATE(fuel_date)
       ) fd ON fd.truck_id = tr.truck_id AND fd.fuel_day = DATE(tr.trip_date)
       GROUP BY t.truck_id, t.truck_no
       ORDER BY net_profit DESC, t.truck_no ASC`
    );
    return res.json(rows.map((row) => ({
      ...row,
      trip_count: Number(row.trip_count || 0),
      total_billed: Number(row.total_billed || 0),
      fuel_cost: Number(row.fuel_cost || 0),
      net_profit: Number(row.net_profit || 0),
    })));
  } catch (err) {
    return next(err);
  }
}

async function getDriverPerformanceReport(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT d.driver_id, d.name,
              COUNT(tr.trip_id) AS total_trips,
              COALESCE(SUM(tr.amount), 0) AS total_billed,
              COALESCE(SUM(f.liters), 0) AS total_fuel_liters
       FROM driver_details d
       LEFT JOIN trips tr ON tr.driver_id = d.driver_id
       LEFT JOIN fuel_details f ON f.driver_id = d.driver_id
       GROUP BY d.driver_id, d.name
       ORDER BY total_billed DESC, total_trips DESC`
    );
    return res.json(rows.map((row) => ({
      ...row,
      total_trips: Number(row.total_trips || 0),
      total_billed: Number(row.total_billed || 0),
      total_fuel_liters: Number(row.total_fuel_liters || 0),
    })));
  } catch (err) {
    return next(err);
  }
}

async function getFuelConsumptionReport(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT t.truck_no, DATE_FORMAT(f.fuel_date, '%Y-%m') AS month,
              COALESCE(SUM(f.liters), 0) AS total_liters,
              COALESCE(SUM(f.price), 0) AS total_cost
       FROM fuel_details f
       LEFT JOIN truck_details t ON t.truck_id = f.truck_id
       GROUP BY t.truck_no, DATE_FORMAT(f.fuel_date, '%Y-%m')
       ORDER BY month DESC, total_liters DESC`
    );
    return res.json(rows.map((row) => ({
      ...row,
      total_liters: Number(row.total_liters || 0),
      total_cost: Number(row.total_cost || 0),
    })));
  } catch (err) {
    return next(err);
  }
}

async function getMaintenanceExpenseReport(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT t.truck_no, DATE_FORMAT(m.service_date, '%Y-%m') AS month,
              COUNT(*) AS service_count,
              COALESCE(SUM(m.cost), 0) AS total_cost
       FROM maintenance_records m
       LEFT JOIN truck_details t ON t.truck_id = m.truck_id
       GROUP BY t.truck_no, DATE_FORMAT(m.service_date, '%Y-%m')
       ORDER BY month DESC, total_cost DESC`
    );
    return res.json(rows.map((row) => ({
      ...row,
      service_count: Number(row.service_count || 0),
      total_cost: Number(row.total_cost || 0),
    })));
  } catch (err) {
    return next(err);
  }
}

async function getDocumentExpiryReport(req, res, next) {
  try {
    return res.json({
      available: false,
      message: "Document expiry tracking is not available yet because no document-expiry schema exists in this app.",
      rows: [],
    });
  } catch (err) {
    return next(err);
  }
}

async function getMonthlyBusinessSummary(req, res, next) {
  try {
    const [[summary]] = await pool.query(
      `SELECT
         (SELECT COALESCE(SUM(amount), 0) FROM trips
          WHERE YEAR(trip_date) = YEAR(CURDATE()) AND MONTH(trip_date) = MONTH(CURDATE())) AS billed_total,
         (SELECT COALESCE(SUM(amount), 0) FROM customer_transactions
          WHERE YEAR(payment_date) = YEAR(CURDATE()) AND MONTH(payment_date) = MONTH(CURDATE())) AS collection_total,
         (SELECT COALESCE(SUM(price), 0) FROM fuel_details
          WHERE YEAR(fuel_date) = YEAR(CURDATE()) AND MONTH(fuel_date) = MONTH(CURDATE())) AS fuel_total,
         (SELECT COALESCE(SUM(cost), 0) FROM maintenance_records
          WHERE YEAR(service_date) = YEAR(CURDATE()) AND MONTH(service_date) = MONTH(CURDATE())) AS maintenance_total,
         (SELECT COUNT(*) FROM trips
          WHERE YEAR(trip_date) = YEAR(CURDATE()) AND MONTH(trip_date) = MONTH(CURDATE())) AS trip_count`
    );

    return res.json({
      billed_total: Number(summary.billed_total || 0),
      collection_total: Number(summary.collection_total || 0),
      fuel_total: Number(summary.fuel_total || 0),
      maintenance_total: Number(summary.maintenance_total || 0),
      trip_count: Number(summary.trip_count || 0),
      net_after_costs: Number(
        (Number(summary.collection_total || 0) - Number(summary.fuel_total || 0) - Number(summary.maintenance_total || 0)).toFixed(2)
      ),
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  exportTripsPdf,
  exportTripsExcel,
  exportFuelExcel,
  exportMonthlyRevenueExcel,
  exportMonthlyRevenuePdf,
  exportDailyRevenuePdf,
  exportDailyRevenueExcel,
  getCustomerOutstandingReport,
  getCustomerLedgerReport,
  getDailyCollectionReport,
  getMonthlyCollectionReport,
  getTruckProfitabilityReport,
  getDriverPerformanceReport,
  getFuelConsumptionReport,
  getMaintenanceExpenseReport,
  getDocumentExpiryReport,
  getMonthlyBusinessSummary,
};
