const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ override: true });

/**
 * Utility to perform a full database backup using mysqldump.
 * The resulting SQL file is stored in the server/backups directory with a timestamped filename.
 * 
 * @returns {Promise<string>} Resolved with the file path of the created backup.
 */
function backupDatabase() {
  return new Promise((resolve, reject) => {
    const backupDir = path.join(__dirname, '..', 'backups');
    
    // Ensure the backup destination directory exists.
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Generate a timestamped filename for the backup.
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `db-backup-${dateStr}.sql`;
    const filePath = path.join(backupDir, filename);

    const dbUser = process.env.DB_USER || 'root';
    const dbPass = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME || 'trucks';
    const dbHost = process.env.DB_HOST || 'localhost';

    /**
     * Construct the mysqldump command.
     * Prioritize MYSQLDUMP_PATH from environment variables for cross-platform support.
     */
    const mysqldumpExe = process.env.MYSQLDUMP_PATH ? `"${process.env.MYSQLDUMP_PATH}"` : 'mysqldump';
    const cmd = `${mysqldumpExe} -h ${dbHost} -u ${dbUser} ${dbPass ? `--password=${dbPass}` : ''} ${dbName} > "${filePath}"`;

    console.log(`[Backup] Initiating database backup to: ${filename}`);

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`[Backup Error] Operation failed: ${error.message}`);
        return reject(error);
      }
      if (stderr && !stderr.includes('Warning')) {
        console.warn(`[Backup Warning] ${stderr}`);
      }
      
      console.log(`[Backup Success] Database backup completed: ${filename}`);
      resolve(filePath);
    });
  });
}

module.exports = backupDatabase;
