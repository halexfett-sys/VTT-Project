import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Campaign } from "../shared/types";
export function openDatabase(root: string) {
  mkdirSync(root, { recursive: true });
  const db = new DatabaseSync(path.join(root, "tabletop.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS campaigns(id TEXT PRIMARY KEY,name TEXT NOT NULL,invite TEXT UNIQUE NOT NULL,state TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS memberships(campaign_id TEXT REFERENCES campaigns(id),user_id TEXT REFERENCES users(id),PRIMARY KEY(campaign_id,user_id));
 CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY,campaign_id TEXT REFERENCES campaigns(id),owner_id TEXT REFERENCES users(id),filename TEXT NOT NULL);`);
  return {
    db,
    get(id: string) {
      const row = db
        .prepare("SELECT state FROM campaigns WHERE id=?")
        .get(id) as { state: string } | undefined;
      if (!row) throw new Error("Campaign not found");
      return JSON.parse(row.state) as Campaign;
    },
    save(c: Campaign) {
      c.revision++;
      db.exec("BEGIN");
      try {
        db.prepare(
          "INSERT INTO campaigns VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,state=excluded.state",
        ).run(c.id, c.name, c.invite, JSON.stringify(c));
        for (const m of c.members)
          db.prepare("INSERT OR IGNORE INTO memberships VALUES(?,?)").run(
            c.id,
            m.userId,
          );
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
