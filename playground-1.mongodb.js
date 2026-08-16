// 1. Select the project database
use('digital_twin_db');

// 2. Count total documents stored in load_telemetry
const totalCount = db.getCollection('load_telemetry').countDocuments();
console.log(`Total Telemetry Documents: ${totalCount}`);

// 3. View the 10 most recent live telemetry points
db.getCollection('load_telemetry')
  .find({})
  .sort({ timestamp: -1 })
  .limit(10);
