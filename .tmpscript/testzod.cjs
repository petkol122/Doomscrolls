const { z } = require("zod");
const s = z.string().url();
console.log("localhost:", JSON.stringify(s.safeParse("http://localhost:5174")));
console.log("127.0.0.1:", JSON.stringify(s.safeParse("http://127.0.0.1:5174")));
console.log("100.101.190.70:", JSON.stringify(s.safeParse("http://100.101.190.70:5173")));
console.log("example.com:", JSON.stringify(s.safeParse("http://example.com:5173")));
console.log("zod version:", require("zod/package.json").version);
