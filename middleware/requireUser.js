// /** Requires a logged-in user */
// export default async function requireUser(req, res, next) {
//   if (!req.user) return res.status(401).send("Unauthorized");
//   next();
// }
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("FATAL ERROR: JWT_SECRET is not defined.");
}

export function requireUser(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send("Unauthorized");
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    return res.status(401).send("Unauthorized");
  }
}
