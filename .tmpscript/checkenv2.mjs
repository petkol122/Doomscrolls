import dotenv from "dotenv";
const r = dotenv.config();
console.log("PARSED:", JSON.stringify(r.parsed));
console.log("EXTRA:", process.env.CLIENT_ORIGIN_EXTRA);
console.log("ORIGIN:", process.env.CLIENT_ORIGIN);
