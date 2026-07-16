import express from "express";
import db from "../db/client.js";
import { requireUser } from "../middleware/requireUser.js";

const router = express.Router();

// GET /products
router.get("/", async (req, res, next) => {
  try {
    const { rows } = await db.query("SELECT * FROM products");
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /products/:id
router.get("/:id", async (req, res, next) => {
  try {
    const {
      rows: [product],
    } = await db.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (!product) return res.status(404).send("Product not found");
    res.status(200).json(product);
  } catch (err) {
    next(err);
  }
});

// protected - sGET /products/:id/orders
// Send 404 if product does not exist
router.get("/:id/orders", async (req, res, next) => {
  try {
    const {
      rows: [product],
    } = await db.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (!product) {
      return res.status(404).send("Product not found");
    }

    // Wrap the authorized database fetch inside requireUser
    requireUser(req, res, async () => {
      const { rows } = await db.query(
        `SELECT o.* FROM orders o 
         JOIN orders_products op ON o.id = op.order_id 
         WHERE op.product_id = $1 AND o.user_id = $2`,
        [req.params.id, req.user.id],
      );
      res.status(200).json(rows);
    });
  } catch (err) {
    next(err);
  }
});

export default router;
