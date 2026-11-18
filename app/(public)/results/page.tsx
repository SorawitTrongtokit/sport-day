import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import { ResultList } from "@/components/results/result-list";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/section-heading";
import { ShowMore } from "@/components/shared/show-more";
import { SportFilter } from "@/components/shared/sport-filter";
import { parseSteps, RESULTS_MAX_STEPS, RESULTS_PAGE_SIZE } from "@/lib/pagination";
import { requirePageVisible } from "@/lib/queries/config";
import { getCompletedMatches } from "@/lib/queries/matches";
import { getActiveSports } from "@/lib/queries/sports";
import { findSportGroup, groupSports } from "@/lib/sport-groups";

export const metadata: Metadata = { title: "ผลการแข่งขัน" };
export const dynamic = "force-dynamic";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; show?: string }>;
}) {
  await requirePageVisible("resultsPage");
  const { sport, show } = await searchParams;
  const sports = await getActiveSports();
  const sportGroups = groupSports(sports);
  const sportGroup = findSportGroup(sportGroups, sport);
  const steps = parseSteps(show);
  const limit = steps * RESULTS_PAGE_SIZE;
  const rows = await getCompletedMatches(sportGroup?.sportIds, limit);
  const matches = rows.slice(0, limit);
  const hasMore = rows.length > limit && steps < RESULTS_MAX_STEPS;
  const query = new URLSearchParams();
  if (sportGroup) query.set("sport", sportGroup.id);
  query.set("show", String(steps + 1));

  return (
    <>
      <PageHeader
        eyebrow="Results"
        title="ผลการแข่งขัน"
        description="ผลการแข่งขันที่เสร็จสิ้นแล้วทั้งหมด เรียงจากล่าสุด"
      />
      <div className="container-page space-y-6 py-8">
        <SportFilter
          sports={sportGroups}
          selectedId={sportGroup?.id}
          hrefFor={(id) => (id ? `/results?sport=${id}` : "/results")}
        />
        {matches.length > 0 ? (
          <>
            <ResultList matches={matches} />
            {hasMore && <ShowMore href={`/results?${query}`} />}
          </>
        ) : (
          <EmptyState icon={Trophy} message="ยังไม่มีผลการแข่งขัน" />
        )}
      </div>
    </>
  );
}
