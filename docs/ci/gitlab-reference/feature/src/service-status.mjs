export function getServiceStatus({ plannedMaintenance = false } = {}) {
  if (plannedMaintenance) {
    return {
      state: "maintenance",
      message: "Scheduled maintenance is in progress.",
    };
  }
  return {
    state: "operational",
    message: "Service is operational.",
  };
}
