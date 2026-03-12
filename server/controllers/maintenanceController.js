const maintenanceModel = require("../models/maintenanceModel");

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
    await maintenanceModel.createMaintenance(truck_id, service_date, cost, description);
    res.status(201).json({ message: "Maintenance record added" });
  } catch (err) {
    next(err);
  }
};

exports.updateMaintenance = async (req, res, next) => {
  try {
    const { truck_id, service_date, cost, description } = req.body;
    await maintenanceModel.updateMaintenance(req.params.id, truck_id, service_date, cost, description);
    res.json({ message: "Maintenance updated" });
  } catch (err) {
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
