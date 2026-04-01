const express = require("express");
const router = express.Router();
const maintenanceController = require("../controllers/maintenanceController");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit to allow high-res mobile photos
});

router.get("/maintenance", maintenanceController.getMaintenance);
router.get("/maintenance/:id/proof", maintenanceController.viewProof);
router.post("/maintenance", upload.single("proof_document"), maintenanceController.addMaintenance);
router.put("/maintenance/:id", upload.single("proof_document"), maintenanceController.updateMaintenance);
router.delete("/maintenance/:id", maintenanceController.deleteMaintenance);

module.exports = router;
