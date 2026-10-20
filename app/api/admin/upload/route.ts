import { NextRequest } from "next/server";
import { isAdmin, unauthorized } from "../../../lib/auth";
import { handleUpload } from "../../../lib/upload";

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  return handleUpload(req);
}
