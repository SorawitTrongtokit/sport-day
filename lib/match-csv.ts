import { FORMAT_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { MatchView } from "@/lib/queries/matches";

type CsvCell = string | number | null;

function escapeCell(value: CsvCell) {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  // Spreadsheet apps can treat text as a formula even inside a quoted CSV field.
  const text = /^[\t\r\n]|^\s*[=+\-@＝＋－＠]/u.test(value) ? `'${value}` : value;
  return `"${text.replaceAll('"', '""')}"`;
}

function formatCsv(rows: CsvCell[][]) {
  // UTF-8 BOM keeps Thai text readable when opening the file directly in Excel.
  return "\uFEFF" + rows.map((row) => row.map(escapeCell).join(",")).join("\r\n") + "\r\n";
}

const matchHeaders = ["รหัสการแข่งขัน", "วันที่", "เวลา", "กีฬา", "รอบ", "รูปแบบ"];

function matchCells(match: MatchView): CsvCell[] {
  return [
    match.id,
    match.date,
    match.startTime.slice(0, 5),
    match.sport.name,
    match.round,
    FORMAT_LABELS[match.format],
  ];
}

export function scheduleCsv(matches: MatchView[]) {
  return formatCsv([
    [...matchHeaders, "ทีม A", "ทีม B", "สถานะ"],
    ...matches.map((match) => [
      ...matchCells(match), match.teamA?.name ?? null, match.teamB?.name ?? null,
      STATUS_LABELS[match.status],
    ]),
  ]);
}

export function resultsCsv(matches: MatchView[]) {
  return formatCsv([
    [...matchHeaders, "ทีม", "สกอร์", "อันดับ", "คะแนนสะสม"],
    ...matches.flatMap((match) =>
      match.lines.map((line) => [
        ...matchCells(match), line.team.name, line.score, line.position, line.points,
      ]),
    ),
  ]);
}
