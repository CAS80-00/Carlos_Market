import db from "#db/client";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

beforeAll(async () => {
  await db.connect();
});
afterAll(async () => {
  await db.end();
});

describe("Database schema", () => {
  test("users table is created with correct columns and constraints", async () => {
    const columns = await getColumns("users");
    expect(columns).toEqual(
      expect.arrayContaining([
        { column_name: "id", data_type: "integer", is_nullable: "NO" },
        { column_name: "username", data_type: "text", is_nullable: "NO" },
        { column_name: "password", data_type: "text", is_nullable: "NO" },
      ]),
    );

    const isUsernameUnique = await isColumnConstrained(
      "users",
      "username",
      "unique",
    );
    expect(isUsernameUnique).toBe(true);
  });

  test("orders table is created with correct columns and constraints", async () => {
    const columns = await getColumns("orders");
    expect(columns).toEqual(
      expect.arrayContaining([
        { column_name: "id", data_type: "integer", is_nullable: "NO" },
        { column_name: "date", data_type: "date", is_nullable: "NO" },
        { column_name: "note", data_type: "text", is_nullable: "YES" },
        { column_name: "user_id", data_type: "integer", is_nullable: "NO" },
      ]),
    );

    const isUserIdForeignKey = await isColumnConstrained(
      "orders",
      "user_id",
      "foreign key",
    );
    expect(isUserIdForeignKey).toBe(true);
  });

  test("products table is created with correct columns and constraints", async () => {
    const columns = await getColumns("products");
    expect(columns).toEqual(
      expect.arrayContaining([
        { column_name: "id", data_type: "integer", is_nullable: "NO" },
        { column_name: "title", data_type: "text", is_nullable: "NO" },
        { column_name: "description", data_type: "text", is_nullable: "NO" },
        { column_name: "price", data_type: "numeric", is_nullable: "NO" },
      ]),
    );
  });

  test("orders_products table is created with correct columns and constraints", async () => {
    const columns = await getColumns("orders_products");
    expect(columns).toEqual(
      expect.arrayContaining([
        { column_name: "order_id", data_type: "integer", is_nullable: "NO" },
        { column_name: "product_id", data_type: "integer", is_nullable: "NO" },
        { column_name: "quantity", data_type: "integer", is_nullable: "NO" },
      ]),
    );

    const isOrderIdForeignKey = await isColumnConstrained(
      "orders_products",
      "order_id",
      "foreign key",
    );
    expect(isOrderIdForeignKey).toBe(true);

    const isProductIdForeignKey = await isColumnConstrained(
      "orders_products",
      "product_id",
      "foreign key",
    );
    expect(isProductIdForeignKey).toBe(true);

    const isOrderIdPrimaryKey = await isColumnConstrained(
      "orders_products",
      "order_id",
      "primary key",
    );

    const isProductIdPrimaryKey = await isColumnConstrained(
      "orders_products",
      "order_id",
      "primary key",
    );

    expect(isOrderIdPrimaryKey && isProductIdPrimaryKey).toBe(true);
  });
});

describe("Database is seeded with", () => {
  let userId;
  let orderId;

  test("at least 1 user", async () => {
    const {
      rows: [user],
    } = await db.query("SELECT * FROM users");
    expect(user).toBeDefined();
    userId = user.id;
  });

  test("at least 10 different products", async () => {
    const { rowCount } = await db.query("SELECT * FROM products");
    expect(rowCount).toBeGreaterThanOrEqual(10);
  });

  test("at least 1 order by the user", async () => {
    const {
      rows: [order],
    } = await db.query("SELECT * FROM orders WHERE user_id = $1", [userId]);
    expect(order).toBeDefined();
    orderId = order.id;
  });

  test("an order by the user of at least 5 distinct products", async () => {
    const { rowCount } = await db.query(
      "SELECT DISTINCT product_id FROM orders_products WHERE order_id = $1",
      [orderId],
    );
    expect(rowCount).toBeGreaterThanOrEqual(5);
  });
});

async function getColumns(table) {
  const sql = `
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = $1
  `;
  const { rows } = await db.query(sql, [table]);
  return rows;
}

async function isColumnConstrained(table, column, constraint) {
  const sql = `
  SELECT *
  FROM
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON kcu.constraint_name = tc.constraint_name
  WHERE
    tc.table_name = $1
    AND kcu.column_name = $2
    AND tc.constraint_type ilike $3
  `;
  const { rowCount } = await db.query(sql, [table, column, constraint]);
  return rowCount > 0;
}
