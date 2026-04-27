const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice(7);
  const jwtSecret = process.env.JWT_SECRET || "dev-jwt-secret";

  try {
    const payload = jwt.verify(token, jwtSecret);
    const userId = payload.userId || payload.sub;

    if (!userId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    req.user = {
      userId,
      email: payload.email,
      role: payload.role,
      raw: payload,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

module.exports = authMiddleware;
