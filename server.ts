import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "metabolic-secret-key-2026";

// Database setup
const DB_PATH = process.env.DATABASE_PATH || "metabolic.db";

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (dbDir !== "." && !fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    age INTEGER,
    gender TEXT,
    height REAL,
    weight REAL,
    activity_level TEXT,
    target_weight REAL
  );

  CREATE TABLE IF NOT EXISTS measurements (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    date TEXT,
    weight REAL,
    bmi REAL,
    bmr REAL,
    tdee REAL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Migration: Add target_weight to users if it doesn't exist
try {
  const tableInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
  const hasTargetWeight = tableInfo.some(col => col.name === 'target_weight');
  if (!hasTargetWeight) {
    db.exec("ALTER TABLE users ADD COLUMN target_weight REAL");
    console.log("Migration: Added target_weight column to users table");
  }
} catch (error) {
  console.error("Migration error:", error);
}

app.use(express.json());

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    
    // Verify user still exists in DB
    const userExists = db.prepare("SELECT id FROM users WHERE id = ?").get(user.id);
    if (!userExists) {
      return res.status(401).json({ error: "User no longer exists" });
    }
    
    req.user = user;
    next();
  });
};

// --- API Routes ---

// Register
app.post("/api/auth/register", async (req, res) => {
  const { email, password, age, gender, height, weight, activityLevel, targetWeight } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    
    const insert = db.prepare(`
      INSERT INTO users (id, email, password, age, gender, height, weight, activity_level, target_weight)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insert.run(userId, email, hashedPassword, age, gender, height, weight, activityLevel, targetWeight || null);
    
    const token = jwt.sign({ id: userId, email }, JWT_SECRET);
    res.json({ token, user: { id: userId, email, age, gender, height, weight, activityLevel, targetWeight } });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Email already exists or invalid data" });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
  
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
  res.json({ 
    token, 
    user: { 
      id: user.id, 
      email: user.email, 
      age: user.age, 
      gender: user.gender, 
      height: user.height, 
      weight: user.weight, 
      activityLevel: user.activity_level,
      targetWeight: user.target_weight
    } 
  });
});

// Get Profile
app.get("/api/profile", authenticateToken, (req: any, res) => {
  const user = db.prepare("SELECT id, email, age, gender, height, weight, activity_level as activityLevel, target_weight as targetWeight FROM users WHERE id = ?").get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(user);
});

// Update Profile
app.put("/api/profile", authenticateToken, (req: any, res) => {
  const { age, gender, height, weight, activityLevel, targetWeight } = req.body;
  db.prepare(`
    UPDATE users 
    SET age = ?, gender = ?, height = ?, weight = ?, activity_level = ?, target_weight = ?
    WHERE id = ?
  `).run(age, gender, height, weight, activityLevel, targetWeight || null, req.user.id);
  res.json({ success: true });
});

// Get Measurements
app.get("/api/measurements", authenticateToken, (req: any, res) => {
  const measurements = db.prepare("SELECT * FROM measurements WHERE user_id = ? ORDER BY date DESC").all(req.user.id);
  res.json(measurements);
});

// Add Measurement
app.post("/api/measurements", authenticateToken, (req: any, res) => {
  const { weight, bmi, bmr, tdee } = req.body;
  const id = crypto.randomUUID();
  const date = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO measurements (id, user_id, date, weight, bmi, bmr, tdee)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, date, weight, bmi, bmr, tdee);
  
  // Also update current weight in profile
  db.prepare("UPDATE users SET weight = ? WHERE id = ?").run(weight, req.user.id);
  
  res.json({ id, date, weight, bmi, bmr, tdee });
});

// Delete Measurement
app.delete("/api/measurements/:id", authenticateToken, (req: any, res) => {
  db.prepare("DELETE FROM measurements WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
  res.json({ success: true });
});

// Clear History
app.delete("/api/measurements", authenticateToken, (req: any, res) => {
  db.prepare("DELETE FROM measurements WHERE user_id = ?").run(req.user.id);
  res.json({ success: true });
});

// --- Vite Middleware ---
async function startServer() {
  const distPath = path.join(__dirname, "dist");
  const indexHtmlPath = path.join(distPath, "index.html");
  
  // Determine if we should run in production mode
  // We only run in production if NODE_ENV is production AND the build artifacts exist
  let isProduction = process.env.NODE_ENV === "production";
  
  if (isProduction && (!fs.existsSync(distPath) || !fs.existsSync(indexHtmlPath))) {
    console.warn("⚠️  NODE_ENV is 'production' but 'dist/index.html' is missing.");
    console.warn("⚠️  Falling back to development mode (Vite middleware).");
    isProduction = false;
  }

  if (!isProduction) {
    console.log("🚀 Starting in Development Mode");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("🚀 Starting in Production Mode");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(indexHtmlPath);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
