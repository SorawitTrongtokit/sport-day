"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { saveHomeSectionOrder, setSectionVisibility } from "@/lib/actions/display";
import { HOME_SECTIONS, PAGE_SECTIONS, type HomeSectionKey, type SectionKey, type Visibility } from "@/lib/visibility";

const GROUPS = [
  { group: "page", title: "เมนูและหน้าเว็บ", hint: "หน้าที่ปิดจะหายจากเมนู และเปิดลิงก์ตรงไม่ได้" },
  { group: "home", title: "ส่วนต่าง ๆ ในหน้าแรก", hint: "ใช้ลูกศรเลื่อนแต่ละส่วนขึ้นหรือลง แล้วกดบันทึกลำดับ" },
] as const;

/** One switch per public section; each flip saves immediately. */
export function VisibilitySwitches({
  visibility,
  homeSectionOrder,
}: {
  visibility: Visibility;
  homeSectionOrder: HomeSectionKey[];
}) {
  const [state, setState] = useState(visibility);
  const [savedOrder, setSavedOrder] = useState(homeSectionOrder);
  const [order, setOrder] = useState(homeSectionOrder);
  const [pending, startTransition] = useTransition();
  const orderChanged = order.some((key, index) => key !== savedOrder[index]);

  function toggle(key: SectionKey, visible: boolean) {
    setState((prev) => ({ ...prev, [key]: visible }));
    startTransition(async () => {
      const result = await setSectionVisibility(key, visible);
      if (result.ok) {
        toast.success(result.message);
      } else {
        setState((prev) => ({ ...prev, [key]: !visible }));
        toast.error(result.message ?? "บันทึกไม่สำเร็จ");
      }
    });
  }

  function moveSection(index: number, direction: -1 | 1) {
    const next = [...order];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setOrder(next);
  }

  function saveOrder() {
    startTransition(async () => {
      try {
        const result = await saveHomeSectionOrder(order);
        if (result.ok) {
          setSavedOrder(order);
          toast.success(result.message);
        } else {
          toast.error(result.message ?? "บันทึกลำดับไม่สำเร็จ");
        }
      } catch {
        toast.error("บันทึกลำดับไม่สำเร็จ");
      }
    });
  }

  return (
    <div className="divide-y">
      {GROUPS.map(({ group, title, hint }) => (
        <fieldset key={group} className="px-4 py-4 sm:px-6">
          <legend className="sr-only">{title}</legend>
          <p className="text-sm font-semibold" aria-hidden>
            {title}
          </p>
          <p className="mb-2 text-xs text-muted-foreground">{hint}</p>
          <ul className="divide-y">
            {(group === "home"
              ? order.map((key) => HOME_SECTIONS.find((section) => section.key === key)!)
              : PAGE_SECTIONS
            ).map((section, index) => {
              const id = `visibility-${section.key}`;
              return (
                <li key={section.key} className="flex items-center justify-between gap-4 py-2.5">
                  <label htmlFor={id} className="min-w-0 text-sm">
                    {section.label}
                    {"href" in section && (
                      <span className="ml-2 text-xs text-muted-foreground">{section.href}</span>
                    )}
                  </label>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="w-6 text-right text-xs text-muted-foreground">
                      {state[section.key] ? "เปิด" : "ปิด"}
                    </span>
                    <Switch
                      id={id}
                      checked={state[section.key]}
                      disabled={pending}
                      onCheckedChange={(checked) => toggle(section.key, checked)}
                    />
                    {section.group === "home" && (
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={`เลื่อน ${section.label} ขึ้น`}
                          disabled={pending || index === 0}
                          onClick={() => moveSection(index, -1)}
                        >
                          <ChevronUp aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={`เลื่อน ${section.label} ลง`}
                          disabled={pending || index === order.length - 1}
                          onClick={() => moveSection(index, 1)}
                        >
                          <ChevronDown aria-hidden />
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {group === "home" && (
            <Button type="button" size="lg" className="mt-3" disabled={pending || !orderChanged} onClick={saveOrder}>
              บันทึกลำดับ
            </Button>
          )}
        </fieldset>
      ))}
    </div>
  );
}
