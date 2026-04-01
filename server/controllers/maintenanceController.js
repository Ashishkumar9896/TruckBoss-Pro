const maintenanceModel = require("../models/maintenanceModel");
const { clearTruckMaintenance } = require("../models/truckModel");
const { storeProofDocument } = require("../services/proofStorage");
const pool = require("../config/db");
const https = require("https");
const http = require("http");

exports.getMaintenance = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    const result = await maintenanceModel.getMaintenanceRecords(limit, offset);
    res.json({
      page,
      limit,
      totalRecords: result.totalRecords,
      data: result.data
    });
  } catch (err) {
    next(err);
  }
};

exports.addMaintenance = async (req, res, next) => {
  try {
    const { truck_id, service_date, cost, description } = req.body;
    console.log("Maintenance Upload Debug:", { 
      hasFile: !!req.file, 
      fileInfo: req.file ? { name: req.file.originalname, size: req.file.size, type: req.file.mimetype } : "none",
      contentType: req.headers['content-type'],
      body: req.body 
    });
    const proof_document = req.file ? await storeProofDocument(req.file) : null;
    if (req.file && !proof_document) {
      console.error("Maintenance Upload: File was received but storage failed!");
    }
    await maintenanceModel.createMaintenance(truck_id, service_date, cost, description, proof_document);
    // Auto-clear the truck's pending maintenance note
    if (truck_id) await clearTruckMaintenance(truck_id);
    res.status(201).json({ message: "Maintenance record added", proof_stored: !!proof_document });
  } catch (err) {
    err.message = err.message + ` | Debug body: ${JSON.stringify(req.body)}`;
    next(err);
  }
};

exports.updateMaintenance = async (req, res, next) => {
  try {
    const { truck_id, service_date, cost, description } = req.body;
    const proof_document = req.file ? await storeProofDocument(req.file) : undefined;
    await maintenanceModel.updateMaintenance(req.params.id, truck_id, service_date, cost, description, proof_document);
    // Auto-clear the truck's pending maintenance note
    if (truck_id) await clearTruckMaintenance(truck_id);
    res.json({ message: "Maintenance updated" });
  } catch (err) {
    err.message = err.message + ` | Debug body: ${JSON.stringify(req.body)}`;
    next(err);
  }
};

exports.deleteMaintenance = async (req, res, next) => {
  try {
    await maintenanceModel.deleteMaintenance(req.params.id);
    res.json({ message: "Maintenance deleted" });
  } catch (err) {
    next(err);
  }
};

exports.viewProof = async (req, res, next) => {
  try {
    const [[record]] = await pool.query(
      "SELECT proof_document FROM maintenance_records WHERE maintenance_id = ?",
      [req.params.id]
    );

    if (!record || !record.proof_document) {
      return res.status(404).json({ error: "No proof document found" });
    }

    const proofValue = record.proof_document;

    // If it's a Cloudinary URL, proxy it through our server to avoid 401
    if (/^https?:\/\//i.test(proofValue)) {
      const lib = proofValue.startsWith("https") ? https : http;
      const proxyReq = lib.get(proofValue, (proxyRes) => {
        // Determine content type from Cloudinary response headers
        const contentType = proxyRes.headers["content-type"] || "application/octet-stream";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", "inline"); // open in browser, not download
        proxyRes.pipe(res);
      });
      proxyReq.on("error", (err) => {
        next(err);
      });
      return;
    }

    // Local file fallback
    const path = require("path");
    const fs = require("fs");
    const localPath = path.join(__dirname, "../../public/uploads/proofs", proofValue);
    if (!fs.existsSync(localPath)) {
      return res.status(404).json({ error: "Proof file not found on server" });
    }
    res.sendFile(localPath);
  } catch (err) {
    next(err);
  }
};
