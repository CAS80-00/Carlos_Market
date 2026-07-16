import express from "express";
import usersRouter from "./routers/users";
import productsRouter from "./routers/products";
import ordersRouter from "./routers/orders";

const app = express();
app.use(express.json());

app.use("/users", usersRouter);
app.use("/products", productsRouter);
app.use("/orders", ordersRouter);

export default app;
