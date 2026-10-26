"use client";

import type { Announcement } from "@/lib/queries/announcements";
import { CheckboxField, FileField, TextareaField, TextField } from "./fields";

export function AnnouncementForm({
  announcement,
  defaultDate,
}: {
  announcement?: Announcement;
  defaultDate: string;
}) {
  return (
    <>
      {announcement && <input type="hidden" name="id" value={announcement.id} />}
      <TextField name="title" label="หัวข้อประกาศ" defaultValue={announcement?.title} />
      <TextareaField
        name="content"
        label="เนื้อหา"
        hint="เว้นว่างได้ถ้ามีไฟล์แนบ"
        rows={6}
        defaultValue={announcement?.content}
      />
      <FileField
        name="attachment"
        label="ไฟล์แนบ (ไม่บังคับ)"
        hint="รูป PNG, JPG, WebP หรือ PDF ขนาดไม่เกิน 4 MB เลือกไฟล์ใหม่จะแทนที่ไฟล์เดิม"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        removeName="removeAttachment"
        removeLabel="ลบไฟล์แนบปัจจุบัน"
        currentUrl={announcement?.attachmentUrl ?? null}
        currentLabel={announcement?.attachmentName ?? undefined}
      />
      <TextField
        name="publishedAt"
        label="วันที่ประกาศ"
        type="date"
        defaultValue={announcement?.publishedAt ?? defaultDate}
      />
      <CheckboxField
        name="isPublished"
        label="เผยแพร่"
        hint="ประกาศที่ยังไม่เผยแพร่จะไม่แสดงบนหน้าเว็บ"
        defaultChecked={announcement?.isPublished ?? true}
      />
    </>
  );
}
