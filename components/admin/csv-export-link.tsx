import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function CsvExportLink({ kind }: { kind: "schedule" | "results" }) {
  return (
    <a
      href={`/api/admin/export/${kind}`}
      className={buttonVariants({ variant: "outline", size: "lg" })}
      download
    >
      <Download aria-hidden />
      ดาวน์โหลด CSV
    </a>
  );
}
