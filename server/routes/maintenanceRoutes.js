const express = require("express");
const router = express.Router();
const maintenanceController = require("../controllers/maintenanceController");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit to allow high-res mobile photos
});

// Wrap multer to return proper JSON errors (e.g. file too large)
function uploadMiddleware(req, res, next) {
  upload.single("proof_document")(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Maximum size is 25MB.' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    next();
  });
}

router.get("/maintenance", maintenanceController.getMaintenance);
router.get("/maintenance/:id/proof", maintenanceController.viewProof);
router.post("/maintenance", uploadMiddleware, maintenanceController.addMaintenance);
router.put("/maintenance/:id", uploadMiddleware, maintenanceController.updateMaintenance);
router.delete("/maintenance/:id", maintenanceController.deleteMaintenance);

module.exports = router;
