import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const IMAGE_DIR = path.join(process.cwd(), "public", "dashboard-cctv");
const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ name: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { name } = await context.params;
  const decodedName = decodeURIComponent(name);
  const extension = path.extname(decodedName).toLowerCase();
  const contentType = CONTENT_TYPES[extension];

  if (!contentType || decodedName.includes("/") || decodedName.includes("\\")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const filePath = path.join(IMAGE_DIR, decodedName);
    const file = await readFile(filePath);
    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}
