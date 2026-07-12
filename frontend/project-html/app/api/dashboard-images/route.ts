import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const IMAGE_DIR = path.join(process.cwd(), "public", "dashboard-cctv");

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entries = await readdir(IMAGE_DIR, { withFileTypes: true });
    const images = entries
      .filter(entry => entry.isFile())
      .map(entry => entry.name)
      .filter(name => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, "ko", { numeric: true }))
      .map(name => ({
        name: path.basename(name, path.extname(name)),
        url: `/api/dashboard-image/${encodeURIComponent(name)}`,
      }));

    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ images: [] });
  }
}
