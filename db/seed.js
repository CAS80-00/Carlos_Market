import "dotenv/config";
import db from "#db/client";
import bcrypt from "bcrypt";

// await db.connect();
// await seed();
// await db.end();
// console.log("🌱 Database seeded.");

async function seed() {
  try {
    await db.connect();
    console.log("Seeding Database...");

    //Seeding 10 times
    const products = [];
    for (let i = 1; i <= 10; i++) {
      const res = await db.query(
        `INSERT INTO products (title, description, price)
        VALUES ($1, $2, $3) RETURNING *`,
        [`Product ${i}`, `Description for product ${i}`, i * 10.0],
      );
      products.push(res.rows[0]);
    }
    //Seeding user
    const hashedPassword = await bcrypt.hash("password", 10);
    const userRes = await db.query(
      `INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *`,
      ["seeduser", hashedPassword],
    );
    const user = userRes.rows[0];

    //Seeding one order for a user
    const orderRes = await db.query(
      `INSERT INTO orders (date, note, user_id) VALUES ($1, $2, $3) RETURNING *`,
      ["2026-07-13", "Initial seed order", user.id],
    );
    const order = orderRes.rows[0];

    //Linking 5 products to the user
    for (let i = 0; i < 5; i++) {
      await db.query(
        `INSERT INTO orders_products (order_id, product_id, quantity) VALUES ($1, $2, $3)`,
        [order.id, products[i].id, 2],
      );
    }

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding datebase:", error);
  } finally {
    await db.end();
  }
}
seed();
