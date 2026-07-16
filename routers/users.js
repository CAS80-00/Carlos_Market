import express from "express";
import db from "../db/client.js";
import { requireUser } from "../middleware/requireUser.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = express.Router();
// In middleware/auth.js and routers/users.js
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("FATAL ERROR: JWT_SECRET is not defined.");
}
// POST /users/register
router.post("/register", async (req, res, next) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send("Missing credentials");
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const {
      rows: [user],
    } = await db.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username",
      [username, hashedPassword],
    );
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
    );
    res.status(201).send(token);
  } catch (err) {
    next(err);
  }
});

// POST /users/login
router.post("/login", async (req, res, next) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send("Missing credentials");
  }

  try {
    const {
      rows: [user],
    } = await db.query("SELECT * FROM users WHERE username = $1", [username]);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).send("Invalid credentials");
    }
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
    );
    res.status(200).send(token);
  } catch (err) {
    next(err);
  }
});

export default router;
