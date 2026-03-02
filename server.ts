import express from "express";
import { createServer as createViteServer } from "vite";
import pg from "pg";
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
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Neon
  }
});

// Initialize tables
const initDb = async () => {
  try {
    await pool.query(`
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
    `);

    await pool.query(`
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
    // In Postgres, we can use IF NOT EXISTS with ALTER TABLE in newer versions, 
    // or check information_schema. For simplicity, we'll try to add it and ignore error if exists
    try {
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS target_weight REAL");
      console.log("Migration: Checked target_weight column in users table");
    } catch (e) {
      // Column likely exists or other error, ignore
    }

    console.log("Database initialized");
  } catch (err) {
    console.error("Database initialization error:", err);
  }
};

initDb();

app.use(express.json());

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    
    try {
      // Verify user still exists in DB
      const result = await pool.query("SELECT id FROM users WHERE id = $1", [user.id]);
      if (result.rows.length === 0) {
        return res.status(401).json({ error: "User no longer exists" });
      }
      
      req.user = user;
      next();
    } catch (error) {
      console.error(error);
      res.sendStatus(500);
    }
  });
};

// --- API Routes ---

// Register
app.post("/api/auth/register", async (req, res) => {
  const { email, password, age, gender, height, weight, activityLevel, targetWeight } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    
    await pool.query(
      `INSERT INTO users (id, email, password, age, gender, height, weight, activity_level, target_weight)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, email, hashedPassword, age, gender, height, weight, activityLevel, targetWeight || null]
    );
    
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
  
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];
    
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get Profile
app.get("/api/profile", authenticateToken, async (req: any, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, age, gender, height, weight, activity_level as \"activityLevel\", target_weight as \"targetWeight\" FROM users WHERE id = $1", 
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update Profile
app.put("/api/profile", authenticateToken, async (req: any, res) => {
  const { age, gender, height, weight, activityLevel, targetWeight } = req.body;
  try {
    await pool.query(`
      UPDATE users 
      SET age = $1, gender = $2, height = $3, weight = $4, activity_level = $5, target_weight = $6
      WHERE id = $7
    `, [age, gender, height, weight, activityLevel, targetWeight || null, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get Measurements
app.get("/api/measurements", authenticateToken, async (req: any, res) => {
  try {
    const result = await pool.query("SELECT * FROM measurements WHERE user_id = $1 ORDER BY date DESC", [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add Measurement
app.post("/api/measurements", authenticateToken, async (req: any, res) => {
  const { weight, bmi, bmr, tdee } = req.body;
  const id = crypto.randomUUID();
  const date = new Date().toISOString();
  
  try {
    await pool.query(`
      INSERT INTO measurements (id, user_id, date, weight, bmi, bmr, tdee)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [id, req.user.id, date, weight, bmi, bmr, tdee]);
    
    // Also update current weight in profile
    await pool.query("UPDATE users SET weight = $1 WHERE id = $2", [weight, req.user.id]);
    
    res.json({ id, date, weight, bmi, bmr, tdee });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete Measurement
app.delete("/api/measurements/:id", authenticateToken, async (req: any, res) => {
  try {
    await pool.query("DELETE FROM measurements WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Clear History
app.delete("/api/measurements", authenticateToken, async (req: any, res) => {
  try {
    await pool.query("DELETE FROM measurements WHERE user_id = $1", [req.user.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
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
