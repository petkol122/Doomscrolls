import { z } from "zod";
const s = z.string().url().optional();
console.log("5174:", s.safeParse("http://localhost:5174"));
console.log("5173:", s.safeParse("http://localhost:5173"));
console.log("ip:", s.safeParse("http://100.101.190.70:5173"));
