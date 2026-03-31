const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ override: true });

function backupDatabase() {
  return new Promise((resolve, reject) => {
    const backupDir = path.join(__dirname, '..', 'backups');
    
    // Ensure backups directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `db-backup-${dateStr}.sql`;
    const filePath = path.join(backupDir, filename);

    const dbUser = process.env.DB_USER || 'root';
    const dbPass = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME || 'trucks';
    const dbHost = process.env.DB_HOST || 'localhost';

    // Construct mysqldump command
    // Using --password=... instead of -p... to avoid prompt
    const mysqldumpExe = `"C:\\Program Files\\MySQL\\MySQL Server 9.6\\bin\\mysqldump.exe"`;
    const cmd = `${mysqldumpExe} -h ${dbHost} -u ${dbUser} ${dbPass ? `--password=${dbPass}` : ''} ${dbName} > "${filePath}"`;

    console.log(`[Backup] Starting database backup to ${filename}...`);

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`[Backup Error] Failed to backup database: ${error.message}`);
        return reject(error);
      }
      if (stderr && !stderr.includes('Warning')) {
        console.warn(`[Backup Warning] ${stderr}`);
      }
      
      console.log(`[Backup Success] Database manually backed up to ${filename}`);
      resolve(filePath);
    });
  });
}

module.exports = backupDatabase;
