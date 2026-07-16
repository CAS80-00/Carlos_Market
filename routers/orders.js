import express from "express";
import db from "../db/client.js";
import { requireUser } from "../middleware/requireUser.js";

const router = express.Router();
router.use(requireUser); // Apply authorization check to all routes below

// Protected- POST /orders
router.post("/", async (req, res, next) => {
  const { date, note } = req.body;
  if (!date) {
    return res.status(400).send("Missing date");
  }

  try {
    const {
      rows: [order],
    } = await db.query(
      "INSERT INTO orders (date, note, user_id) VALUES ($1, $2, $3) RETURNING *",
      [date, note || null, req.user.id],
    );
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

// Protected- GET /orders
router.get("/", async (req, res, next) => {
  try {
    const { rows } = await db.query("SELECT * FROM orders WHERE user_id = $1", [
      req.user.id,
    ]);
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// protectted- GET /orders/:id
router.get("/:id", async (req, res, next) => {
  try {
    const {
      rows: [order],
    } = await db.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
    if (!order) return res.status(404).send("Order not found");
    if (order.user_id !== req.user.id) return res.status(403).send("Forbidden");

    res.status(200).json(order);
  } catch (err) {
    next(err);
  }
});

// Protected - POST /orders/:id/products
router.post("/:id/products", async (req, res, next) => {
  const { productId, quantity } = req.body;

  try {
    // 1. Check if order exists
    const {
      rows: [order],
    } = await db.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
    if (!order) return res.status(404).send("Order not found");

    // 2. Verify ownership
    if (order.user_id !== req.user.id) return res.status(403).send("Forbidden");

    // 3. Verify request inputs exist
    if (!productId || !quantity) {
      return res.status(400).send("Missing productId or quantity");
    }

    // 4. Check if targeted product exists
    const {
      rows: [product],
    } = await db.query("SELECT * FROM products WHERE id = $1", [productId]);
    if (!product) return res.status(400).send("Product does not exist");

    // 5. Insert/upsert product into order
    const {
      rows: [opRecord],
    } = await db.query(
      `INSERT INTO orders_products (order_id, product_id, quantity) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (order_id, product_id) DO UPDATE SET quantity = orders_products.quantity + $3
       RETURNING *`,
      [req.params.id, productId, quantity],
    );
    res.status(201).json(opRecord);
  } catch (err) {
    next(err);
  }
});

// Protected - GET /orders/:id/products
router.get("/:id/products", async (req, res, next) => {
  try {
    // 1. Check if order exists
    const {
      rows: [order],
    } = await db.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
    if (!order) return res.status(404).send("Order not found");

    // 2. Verify ownership
    if (order.user_id !== req.user.id) return res.status(403).send("Forbidden");

    // 3. Fetch list of products linked to this order
    const { rows } = await db.query(
      `SELECT p.* FROM products p
       JOIN orders_products op ON p.id = op.product_id
       WHERE op.order_id = $1`,
      [req.params.id],
    );
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
