import app from "#app";
import db from "#db/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, test } from "vitest";

let token;
let lastProduct;
let orderedProduct;

beforeAll(async () => {
  await db.connect();
  await db.query("BEGIN");

  const {
    rows: [product],
  } = await db.query("SELECT * FROM products ORDER BY id DESC");
  lastProduct = product;
  orderedProduct = {
    productId: product.id,
    quantity: 5,
  };
});
afterAll(async () => {
  await db.query("ROLLBACK");
  await db.end();
});

describe("users", () => {
  describe("POST /users/register", () => {
    it("creates a new user and sends back a token", async () => {
      const response = await request(app).post("/users/register").send({
        username: "tasktesttask",
        password: "password",
      });
      expect(response.status).toBe(201);
      expect(response.text).toMatch(/\w+\.\w+\.\w+/);
    });

    it("hashes the password of the created user", async () => {
      const {
        rows: [user],
      } = await db.query(
        "SELECT password FROM users WHERE username = 'tasktesttask'",
      );
      expect(user.password).not.toBe("password");
    });
  });

  describe("POST /users/login", () => {
    it("sends a token if correct credentials are provided", async () => {
      const response = await request(app).post("/users/login").send({
        username: "tasktesttask",
        password: "password",
      });
      expect(response.status).toBe(200);
      expect(response.text).toMatch(/\w+\.\w+\.\w+/);
      token = response.text;
    });

    it("sends 401 if incorrect credentials are provided", async () => {
      const response = await request(app).post("/users/login").send({
        username: "tasktesttask",
        password: "wrongpassword",
      });
      expect(response.status).toBe(401);
    });
  });
});

describe("products", () => {
  test("GET / sends array of all products", async () => {
    const { rows: products } = await db.query("SELECT * FROM products");
    const response = await request(app).get("/products");
    expect(response.status).toBe(200);
    expect(response.body).toEqual(products);
  });

  describe("GET /products/:id", () => {
    it("sends 404 if the product does not exist", async () => {
      const response = await request(app).get(
        "/products/" + (lastProduct.id + 1),
      );
      expect(response.status).toBe(404);
    });

    it("sends the specific product", async () => {
      const response = await request(app).get("/products/" + lastProduct.id);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(lastProduct);
    });
  });
});

describe("orders", () => {
  let newOrderId;
  let forbiddenOrderId;

  describe("POST /orders", () => {
    it("sends 401 if the user is not logged in", async () => {
      const response = await request(app)
        .post("/orders")
        .send({ date: "1111-11-11" });
      expect(response.status).toBe(401);
    });

    it("sends 400 if the order is missing required fields", async () => {
      const response = await request(app)
        .post("/orders")
        .send({})
        .set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(400);
    });

    it("creates a new order", async () => {
      const response = await request(app)
        .post("/orders")
        .send({ date: "1111-11-11" })
        .set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(201);

      const order = response.body;
      expect(order).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          date: expect.any(String),
          user_id: expect.any(Number),
        }),
      );
      newOrderId = order.id;

      const {
        rows: [forbiddenOrder],
      } = await db.query("SELECT * FROM orders WHERE id != $1", [newOrderId]);
      forbiddenOrderId = forbiddenOrder.id;
    });
  });

  describe("GET /orders", () => {
    it("sends 401 if the user is not logged in", async () => {
      const response = await request(app).get("/orders");
      expect(response.status).toBe(401);
    });

    it("sends array of all orders made by the user", async () => {
      const response = await request(app)
        .get("/orders")
        .set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: newOrderId,
          }),
        ]),
      );
    });
  });

  describe("GET /orders/:id", () => {
    it("sends 401 if the user is not logged in", async () => {
      const response = await request(app).get("/orders/" + newOrderId);
      expect(response.status).toBe(401);
    });

    it("sends 404 if the order does not exist", async () => {
      const response = await request(app)
        .get("/orders/" + (newOrderId + 1))
        .set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(404);
    });

    it("sends 403 if the user is not the owner of the order", async () => {
      const response = await request(app)
        .get("/orders/" + forbiddenOrderId)
        .set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it("sends the order with the specified id", async () => {
      const response = await request(app)
        .get("/orders/" + newOrderId)
        .set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(newOrderId);
    });
  });

  describe("POST /orders/:id/products", () => {
    it("sends 401 if the user is not logged in", async () => {
      const response = await request(app).get("/orders/" + newOrderId);
      expect(response.status).toBe(401);
    });

    it("sends 404 if the order does not exist", async () => {
      const response = await request(app)
        .get("/orders/" + (newOrderId + 1))
        .set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(404);
    });

    it("sends 403 if the user is not the owner of the order", async () => {
      const response = await request(app)
        .get("/orders/" + forbiddenOrderId)
        .set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it("sends 400 if the request is missing required fields", async () => {
      const response = await request(app)
        .post("/orders/" + newOrderId + "/products")
        .send({})
        .set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(400);
    });

    it("sends 400 if the product does not exist", async () => {
      await db.query("SAVEPOINT s");
      const response = await request(app)
        .post("/orders/" + newOrderId + "/products")
        .send({ productId: lastProduct.id + 1, quantity: 5 })
        .set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(400);
      await db.query("ROLLBACK TO s");
    });

    it("adds the specified quantity of the product to the order", async () => {
      const response = await request(app)
        .post("/orders/" + newOrderId + "/products")
        .send(orderedProduct)
        .set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(201);
      expect(response.body).toEqual(
        expect.objectContaining({
          order_id: newOrderId,
          product_id: orderedProduct.productId,
          quantity: orderedProduct.quantity,
        }),
      );
    });
  });

  describe("GET /orders/:id/products", () => {
    it("sends 401 if the user is not logged in", async () => {
      const response = await request(app).get("/orders/" + newOrderId);
      expect(response.status).toBe(401);
    });

    it("sends 404 if the order does not exist", async () => {
      const response = await request(app)
        .get("/orders/" + (newOrderId + 1))
        .set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(404);
    });

    it("sends 403 if the user is not the owner of the order", async () => {
      const response = await request(app)
        .get("/orders/" + forbiddenOrderId)
        .set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it("sends the array of products in the order", async () => {
      const response = await request(app)
        .get("/orders/" + newOrderId + "/products")
        .set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([expect.objectContaining(lastProduct)]),
      );
    });
  });

  describe("GET /products/:id/orders", () => {
    it("sends 404 if the product does not exist (even if user is logged in)", async () => {
      const response = await request(app)
        .get("/products/" + (lastProduct.id + 1) + "/orders")
        .set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(404);
    });

    it("sends 401 if the user is not logged in", async () => {
      const response = await request(app).get(
        "/products/" + lastProduct.id + "/orders",
      );
      expect(response.status).toBe(401);
    });

    it("sends array of all orders made by the user that include this product", async () => {
      const response = await request(app)
        .get("/products/" + lastProduct.id + "/orders")
        .set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: newOrderId,
          }),
        ]),
      );
    });
  });
});
