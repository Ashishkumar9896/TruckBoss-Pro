const express = require("express");
const router = express.Router();
const maintenanceController = require("../controllers/maintenanceController");

router.get("/maintenance", maintenanceController.getMaintenance);
router.post("/maintenance", maintenanceController.addMaintenance);
router.put("/maintenance/:id", maintenanceController.updateMaintenance);
router.delete("/maintenance/:id", maintenanceController.deleteMaintenance);

module.exports = router;
