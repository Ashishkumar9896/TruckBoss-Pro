# 🚚 Bihal Suppliers - Handover Guide

Follow these simple steps to set up the project on your new computer.

## 1. Prerequisites (Install these first)
- **Node.js**: [Download here](https://nodejs.org/) (Version 18+). Just click "Next" on everything.
- **MySQL**: Install MySQL (XAMPP or MySQL Workbench). Make sure it's running!

---

## 2. Setting Up the Database
1. Open your MySQL Tool (Workbench / XAMPP Control Panel).
2. Create a new database named **`trucks`**.
3. Import the file named **`database.sql`** (located in the main project folder) into the `trucks` database.
   - *This creates all tables and includes sample data like the "Ashish" admin account.*

---

## 3. Configuration
1. Open the file named **`.env`** in this folder using Notepad.
2. Check the `DB_USER` and `DB_PASSWORD`.
   - Update them to match your local MySQL username (usually `root`) and password.
   - Save and close the file.

---

## 4. First Run
1. Open a **Terminal** or **Command Prompt** inside this project folder.
2. Run this command to install the system:
   ```bash
   npm install
   ```
3. Once finished, start the application:
   ```bash
   npm start
   ```
4. Open your browser and go to: **http://localhost:3000**

---

## 🔑 Your Login Credentials
Use these details to log in for the first time:

**Option 1: Primary Account**
- **Email:** admin@gmail.com
- **Password:** Admin@1234

> **Note:** Once you log in, you can add more users (Managers or Admins) from the **Settings** menu at the top right.

---

