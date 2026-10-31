import pg from "pg";
import fs from "node:fs";
import path from "node:path";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const client = new pg.Client({ connectionString: env.DATABASE_URL || env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(fs.readFileSync(path.join("supabase", "schema.sql"), "utf8"));
console.log("schema applied");
await client.end();
