import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "public", "data", "duvetica_fw_orderlist.json");

export async function GET() {
  try {
    const raw = await readFile(DATA_PATH, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ data: [], columns: [], meta: {} }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const updates: { _row: number; field: string; value: unknown }[] = await req.json();

    const raw = await readFile(DATA_PATH, "utf-8");
    const payload = JSON.parse(raw);
    const data: Record<string, unknown>[] = payload.data;

    const rowMap = new Map<number, Record<string, unknown>>();
    for (const row of data) {
      rowMap.set(row._row as number, row);
    }

    let changed = 0;
    for (const u of updates) {
      const row = rowMap.get(u._row);
      if (row && row[u.field] !== u.value) {
        row[u.field] = u.value;
        changed++;
      }
    }

    if (changed > 0) {
      payload.meta.last_edited = new Date().toISOString();
      await writeFile(DATA_PATH, JSON.stringify(payload), "utf-8");
    }

    return NextResponse.json({ ok: true, changed });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
