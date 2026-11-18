import { todayInBangkok } from "@/lib/date";
import { resultsCsv, scheduleCsv } from "@/lib/match-csv";
import { fetchAllMatches, fetchRecentResults } from "@/lib/queries/matches";
import { getAdminSession } from "@/lib/require-admin";

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!(await getAdminSession())) {
    return new Response("กรุณาเข้าสู่ระบบผู้ดูแล", { status: 401, headers });
  }

  const { kind } = await params;
  if (kind !== "schedule" && kind !== "results") {
    return new Response("ไม่พบรายการส่งออก", { status: 404, headers });
  }

  const csv = kind === "schedule"
    ? scheduleCsv((await fetchAllMatches()).reverse())
    : resultsCsv(await fetchRecentResults());

  return new Response(csv, {
    headers: {
      ...headers,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}-${todayInBangkok()}.csv"`,
    },
  });
}
