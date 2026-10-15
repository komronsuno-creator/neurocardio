import { readData } from "../../lib/store";


export async function GET() {
  const data = await readData();
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
