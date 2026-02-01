import crypto from "crypto";

const url = "http://localhost:3000/api/pierre/execute";

const clientId = "test_company";
const timestamp = Date.now();
const body = {
  client_id: clientId,
  action: "employee.create",
  payload: { first_name: "Julie", last_name: "Martin", email: "julie@test.com" }
};

const rawBody = JSON.stringify(body);
const secret = process.env.ROUTER_HMAC_SECRET;

const signature = crypto
  .createHmac("sha256", secret)
  .update(`${clientId}.${timestamp}.${rawBody}`)
  .digest("hex");

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-client-id": clientId,
    "x-timestamp": String(timestamp),
    "x-signature": signature
  },
  body: rawBody
});

console.log(await res.json());
