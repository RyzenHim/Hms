const DEFAULT_CORS_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function normalizeOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid origin in CORS_ORIGINS: ${value}`);
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`CORS_ORIGINS entries must be HTTP(S) origins without paths: ${value}`);
  }

  return url.origin;
}

function parseCorsOrigins(value = process.env.CORS_ORIGINS) {
  const entries = value === undefined ? DEFAULT_CORS_ORIGINS : value.split(",");
  return new Set(entries.map((entry) => entry.trim()).filter(Boolean).map(normalizeOrigin));
}

function createCorsMiddleware(allowedOrigins = parseCorsOrigins()) {
  return (req, res, next) => {
    const origin = req.get("Origin");
    res.vary("Origin");

    if (origin && allowedOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    } else if (origin && req.method === "OPTIONS") {
      return res.sendStatus(403);
    }

    if (req.method === "OPTIONS") return res.sendStatus(204);
    return next();
  };
}

module.exports = { createCorsMiddleware, parseCorsOrigins };
