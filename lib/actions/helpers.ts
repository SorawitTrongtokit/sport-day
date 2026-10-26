import "server-only";
import { del, put } from "@vercel/blob";
import { updateTag } from "next/cache";
import type { ZodError } from "zod";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { detectUploadType, type UploadType } from "@/lib/image-type";
import type { ActionState } from "@/lib/action-state";
import type { CacheTag } from "@/lib/queries/cache";
import { getAdminSession } from "@/lib/require-admin";

export const UNAUTHORIZED: ActionState = {
  ok: false,
  message: "กรุณาเข้าสู่ระบบผู้ดูแลอีกครั้ง",
};

/** Every admin action calls this first; hiding UI is never the only check. Returns the admin's email. */
export async function adminActor(): Promise<string | null> {
  return (await getAdminSession())?.user.email ?? null;
}

/** Records who did what. A failure to log is reported but never fails the action. */
export async function audit(actor: string, action: string, summary: string) {
  try {
    await db.insert(auditLog).values({ actor, action, summary });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}

export function invalid(error: ZodError): ActionState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, message: "กรุณาตรวจสอบข้อมูลที่กรอก", fieldErrors };
}

export function invalidate(...tags: CacheTag[]) {
  for (const tag of tags) updateTag(tag);
}

/** For an edit whose row another admin deleted while the form was open. */
export function missing(what: string): ActionState {
  return { ok: false, message: `ไม่พบ${what}นี้ อาจถูกลบไปแล้ว กรุณาโหลดหน้าใหม่` };
}

function pgErrorCode(error: unknown): string | undefined {
  for (let e: unknown = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && /^\d{2}[0-9A-Z]{3}$/.test(code)) return code;
  }
  return undefined;
}

/** Logs the real error server-side and returns a message that is safe to show. */
export function failure(
  error: unknown,
  messages: { unique?: string; foreignKey?: string } = {},
): ActionState {
  const code = pgErrorCode(error);
  if (code === "23505" && messages.unique) return { ok: false, message: messages.unique };
  if (code === "23503" && messages.foreignKey) {
    return { ok: false, message: messages.foreignKey };
  }
  console.error(error);
  return { ok: false, message: "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง" };
}

const MB = 1024 * 1024;
const EXTENSIONS: Record<UploadType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** What one kind of upload field accepts, and the words its error messages use. */
export type UploadKind = { types: UploadType[]; maxBytes: number; noun: string; typesLabel: string };

export const IMAGE_UPLOAD: UploadKind = {
  types: ["image/png", "image/jpeg", "image/webp"],
  maxBytes: 2 * MB,
  noun: "ไฟล์รูป",
  typesLabel: "PNG, JPG หรือ WebP",
};

// Vercel Functions reject request bodies over 4.5 MB, so attachments stay under that.
export const ATTACHMENT_UPLOAD: UploadKind = {
  types: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
  maxBytes: 4 * MB,
  noun: "ไฟล์แนบ",
  typesLabel: "PNG, JPG, WebP หรือ PDF",
};

export type UploadResult =
  | { ok: true; url: string; type: UploadType; name: string }
  | { ok: true; url: null; type: null; name: null }
  | { ok: false; message: string };

/** Uploads an optional file field to Vercel Blob. `url` is null when no file was chosen. */
export async function uploadFile(
  value: FormDataEntryValue | null,
  folder: string,
  kind: UploadKind = IMAGE_UPLOAD,
): Promise<UploadResult> {
  if (!(value instanceof File) || value.size === 0) {
    return { ok: true, url: null, type: null, name: null };
  }
  if (value.size > kind.maxBytes) {
    return { ok: false, message: `${kind.noun}ต้องมีขนาดไม่เกิน ${kind.maxBytes / MB} MB` };
  }
  // The browser-supplied MIME type is only a hint; trust the file's own signature.
  const type = detectUploadType(new Uint8Array(await value.slice(0, 12).arrayBuffer()));
  if (!type || !kind.types.includes(type)) {
    return { ok: false, message: `รองรับเฉพาะไฟล์ ${kind.typesLabel}` };
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      ok: false,
      message: "ยังไม่ได้ตั้งค่าที่เก็บไฟล์ (BLOB_READ_WRITE_TOKEN)",
    };
  }
  const extension = EXTENSIONS[type];
  const baseName = type === "application/pdf" ? "document" : "image";
  try {
    const blob = await put(`${folder}/${baseName}.${extension}`, value, {
      access: "public",
      addRandomSuffix: true,
      contentType: type,
    });
    return { ok: true, url: blob.url, type, name: value.name.slice(0, 255) || `${baseName}.${extension}` };
  } catch (error) {
    console.error(error);
    return { ok: false, message: `อัปโหลด${kind.noun}ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง` };
  }
}

const isBlobUrl = (value: string) => {
  try {
    return new URL(value).hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
};

/**
 * Removes uploaded files that nothing references any more (a replaced logo, or an
 * upload whose save failed). Bundled files such as /banner.webp are skipped.
 * A failure is logged but never fails the action.
 */
export async function deleteBlobs(...urls: (string | null | undefined)[]) {
  const targets = urls.filter((url): url is string => !!url && isBlobUrl(url));
  if (targets.length === 0 || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await del(targets);
  } catch (error) {
    console.error("Failed to delete unused files", error);
  }
}
