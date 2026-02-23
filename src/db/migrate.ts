import { promises as fs } from "fs";
import path from "path";
import { withClient } from "./index";

export async function runMigrations(): Promise<void> {
  const dir = path.join(__dirname, "..", "..", "migrations");
  const entries = await fs.readdir(dir);
  const files = entries.filter((f) => f.endsWith(".sql")).sort();
  if (!files.length) return;
  await withClient(async (client) => {
    for (const file of files) {
      const sql = await fs.readFile(path.join(dir, file), "utf8");
      if (!sql.trim()) continue;
      await client.query(sql);
    }
  });
}
