import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, copyFile, access } from "fs/promises";
import path from "path";

const PUBLIC_PATH = path.join(process.cwd(), "public", "data", "duvetica_fw_orderlist.json");
const isVercel = !!process.env.VERCEL;
const TMP_PATH = isVercel ? "/tmp/duvetica_fw_orderlist.json" : PUBLIC_PATH;

async function getDataPath(): Promise<string> {
  if (!isVercel) return PUBLIC_PATH;
  // Vercel: /tmp에 복사본이 없으면 public에서 복사
  try {
    await access(TMP_PATH);
  } catch {
    await copyFile(PUBLIC_PATH, TMP_PATH);
  }
  return TMP_PATH;
}

export async function GET() {
  try {
    const dp = await getDataPath();
    const raw = await readFile(dp, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ data: [], columns: [], meta: {} }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const updates: { _row: number; field: string; value: unknown }[] = await req.json();
    const dp = await getDataPath();
    const raw = await readFile(dp, "utf-8");
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
      await writeFile(dp, JSON.stringify(payload), "utf-8");
    }

    return NextResponse.json({ ok: true, changed });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
