"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import type { ActionState } from "@/lib/action-state";
import { TAGS } from "@/lib/queries/cache";
import { announcementSchema, idSchema } from "@/lib/validations";
import {
  adminActor,
  ATTACHMENT_UPLOAD,
  audit,
  deleteBlobs,
  failure,
  invalid,
  invalidate,
  UNAUTHORIZED,
  uploadFile,
} from "./helpers";

export async function saveAnnouncement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await adminActor();
  if (!actor) return UNAUTHORIZED;
  const parsed = announcementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { id, content, ...rest } = parsed.data;

  const upload = await uploadFile(formData.get("attachment"), "announcements", ATTACHMENT_UPLOAD);
  if (!upload.ok) return { ok: false, fieldErrors: { attachment: [upload.message] } };

  const removeAttachment = formData.get("removeAttachment") === "on" && !upload.url;
  const values = {
    ...rest,
    content: content ?? "",
    ...(upload.url
      ? {
          attachmentUrl: upload.url,
          attachmentType: upload.type === "application/pdf" ? "pdf" : "image",
          attachmentName: upload.name,
        }
      : {}),
    ...(removeAttachment ? { attachmentUrl: null, attachmentType: null, attachmentName: null } : {}),
  };

  let previousAttachment: string | null = null;
  let outcome: "saved" | "missing" | "empty";
  try {
    outcome = await db.transaction(async (tx) => {
      const [current] = id
        ? await tx
            .select({ attachmentUrl: announcements.attachmentUrl })
            .from(announcements)
            .where(eq(announcements.id, id))
            .for("update")
        : [];
      // Another admin may have deleted it while this form was open.
      if (id && !current) return "missing";
      const keepsAttachment = !!upload.url || (!removeAttachment && !!current?.attachmentUrl);
      if (!content && !keepsAttachment) return "empty";
      previousAttachment = current?.attachmentUrl ?? null;
      if (id) await tx.update(announcements).set(values).where(eq(announcements.id, id));
      else await tx.insert(announcements).values(values);
      return "saved";
    });
  } catch (error) {
    await deleteBlobs(upload.url);
    return failure(error);
  }
  if (outcome !== "saved") {
    await deleteBlobs(upload.url);
    return outcome === "missing"
      ? { ok: false, message: "ไม่พบประกาศนี้ อาจถูกลบไปแล้ว" }
      : { ok: false, fieldErrors: { content: ["กรุณากรอกเนื้อหาหรือแนบไฟล์อย่างใดอย่างหนึ่ง"] } };
  }
  if (upload.url || removeAttachment) await deleteBlobs(previousAttachment);
  await audit(actor, id ? "announcement.update" : "announcement.create", rest.title);
  invalidate(TAGS.announcements);
  return { ok: true, message: "บันทึกประกาศแล้ว" };
}

export async function deleteAnnouncement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await adminActor();
  if (!actor) return UNAUTHORIZED;
  const parsed = idSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  let removed: { attachmentUrl: string | null }[];
  try {
    removed = await db.delete(announcements).where(eq(announcements.id, parsed.data.id))
      .returning({ attachmentUrl: announcements.attachmentUrl });
  } catch (error) {
    return failure(error);
  }
  await deleteBlobs(...removed.map((row) => row.attachmentUrl));
  await audit(actor, "announcement.delete", `#${parsed.data.id}`);
  invalidate(TAGS.announcements);
  return { ok: true, message: "ลบประกาศแล้ว" };
}
