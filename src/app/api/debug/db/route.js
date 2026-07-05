import { NextResponse } from "next/server";
import { DATA_FILE } from "@/lib/db/paths";
import { getAdapter } from "@/lib/db/driver";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = await getAdapter();
  const row = db.get(
    "SELECT COUNT(*) AS count FROM providerConnections WHERE provider = ? AND isActive = 1",
    ["autoclaw"]
  );

  return NextResponse.json({
    driver: db.driver,
    dataFile: DATA_FILE,
    autoclawActiveCount: row?.count ?? 0,
    dataDir: process.env.DATA_DIR || null,
    pid: process.pid,
  });
}
