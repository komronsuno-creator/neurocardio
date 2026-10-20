import { NextRequest } from "next/server";
import { doctorIdFrom } from "../../../lib/doctor-auth";
import { handleUpload } from "../../../lib/upload";

export async function POST(req: NextRequest) {
  if (!doctorIdFrom(req)) return Response.json({ error: "Avval tizimga kiring." }, { status: 401 });
  return handleUpload(req);
}
