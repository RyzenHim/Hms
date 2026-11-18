const assert = require("node:assert/strict");
const test = require("node:test");
const { createCorsMiddleware, parseCorsOrigins } = require("../config/cors");

function makeResponse() {
  return {
    headers: {},
    varyHeader: "",
    status: undefined,
    vary(value) {
      this.varyHeader = value;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    sendStatus(status) {
      this.status = status;
      return status;
    },
  };
}

test("CORS origins parse comma-separated entries and normalize trailing slashes", () => {
  assert.deepEqual(
    [...parseCorsOrigins(" https://hms.example.com/,http://localhost:3000 ")],
    ["https://hms.example.com", "http://localhost:3000"],
  );
});

test("allowed origins receive CORS headers and successful preflight responses", () => {
  const middleware = createCorsMiddleware(new Set(["https://hms.example.com"]));
  const req = {
    get: () => "https://hms.example.com",
    method: "OPTIONS",
  };
  const res = makeResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.headers["Access-Control-Allow-Origin"], "https://hms.example.com");
  assert.equal(res.headers["Access-Control-Allow-Methods"], "GET,POST,PUT,DELETE,OPTIONS");
  assert.equal(res.headers["Access-Control-Allow-Headers"], "Content-Type");
  assert.equal(res.varyHeader, "Origin");
  assert.equal(res.status, 204);
  assert.equal(nextCalled, false);
});

test("disallowed origins are rejected for preflight requests", () => {
  const middleware = createCorsMiddleware(new Set(["https://hms.example.com"]));
  const req = {
    get: () => "https://untrusted.example",
    method: "OPTIONS",
  };
  const res = makeResponse();

  middleware(req, res, () => assert.fail("disallowed preflight should not continue"));

  assert.equal(res.status, 403);
  assert.equal(res.headers["Access-Control-Allow-Origin"], undefined);
});

test("invalid configured origins fail instead of silently widening access", () => {
  assert.throws(() => parseCorsOrigins("https://hms.example.com/app"), /without paths/);
});
