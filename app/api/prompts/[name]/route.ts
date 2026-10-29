import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const ALLOWED_TEMPLATES = new Set([
  "analyze",
  "build",
  "install",
  "review-ui",
  "review-page",
  "review-header-footer",
  "review-accessibility",
  "review-performance",
  "review-best-practices",
  "review-seo",
  "review-cache",
  "review-important",
  "review-theme",
  "review-pre-migration",
  "change",
  "review-images",
  "rebuild-page",
  "analyze-page",
  "analyze-header",
  "analyze-footer",
  "analyze-menu",
  "analyze-shop",
  "analyze-product",
  "analyze-global-styles",
  "create",
  "custom-prompt",
  "continue",
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  if (!ALLOWED_TEMPLATES.has(name)) {
    return NextResponse.json({ template: "" }, { status: 404 });
  }

  try {
    const filePath = path.join(process.cwd(), "prompts", `${name}.md`);
    const template = await readFile(filePath, "utf-8");
    return NextResponse.json({ template });
  } catch {
    return NextResponse.json({ template: "" }, { status: 500 });
  }
}
