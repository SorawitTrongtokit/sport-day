import type { Sport } from "@/lib/queries/sports";

const knownGroups = [
  { id: "esports", name: "E-Sports", pattern: /^e\s*-?\s*sports(?=$|[\s(])/i },
  { id: "basketball", name: "บาสเกตบอล", pattern: /^บาสเกตบอล(?=$|[\s(])/ },
  { id: "volleyball", name: "วอลเลย์บอล", pattern: /^วอลเลย์บอล(?=$|[\s(])/ },
  { id: "table-tennis", name: "เทเบิลเทนนิส", pattern: /^เทเบิลเทนนิส(?=$|[\s(])/ },
  { id: "petanque", name: "เปตอง", pattern: /^เปตอง(?=$|[\s(])/ },
  { id: "chairball", name: "แชร์บอล", pattern: /^แชร์บอล(?=$|[\s(])/ },
  { id: "cheerleading", name: "ผู้นำเชียร์", pattern: /^ผู้นำเชียร์(?=$|[\s(])/ },
  { id: "aerobics", name: "แอโรบิก", pattern: /^แอโรบิก(?=$|[\s(])/ },
];

export type SportGroup = {
  id: string;
  name: string;
  icon: string | null;
  sportIds: number[];
};

export function groupSports(sports: Pick<Sport, "id" | "name" | "icon">[]): SportGroup[] {
  const groups = new Map<string, SportGroup>();
  for (const sport of sports) {
    const name = sport.name.trim();
    const knownGroup = knownGroups.find(({ pattern }) => pattern.test(name));
    const id = knownGroup?.id ?? String(sport.id);
    let group = groups.get(id);
    if (!group) {
      group = { id, name: knownGroup?.name ?? name, icon: sport.icon, sportIds: [] };
      groups.set(id, group);
    }
    group.icon ??= sport.icon;
    group.sportIds.push(sport.id);
  }
  return [...groups.values()];
}

export function findSportGroup(groups: SportGroup[], value: string | undefined) {
  // Numeric links from the old filter now select the matching sport group.
  return groups.find((group) =>
    group.id === value || group.sportIds.some((id) => String(id) === value),
  );
}
