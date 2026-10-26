import { ArrowUpRight, Images } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/section-heading";
import { drivePhotoUrl, previewPhotos } from "@/lib/drive";
import type { Gallery } from "@/lib/queries/gallery";

const PREVIEW_COUNT = 6;

/**
 * A strip of photos linking to the gallery page. Falls back to the Drive link when
 * the photos can't be loaded or the gallery page is switched off.
 */
export function GalleryPreview({ gallery, pageVisible }: { gallery: Gallery; pageVisible: boolean }) {
  const photos = gallery.status === "ok" ? previewPhotos(gallery.root, PREVIEW_COUNT) : [];
  if (!pageVisible || photos.length === 0) return <GalleryLink url={gallery.folderUrl} />;
  return (
    <>
      <SectionHeading title="ภาพกิจกรรม" eyebrow="Gallery" href="/gallery" linkLabel="ดูภาพทั้งหมด" />
      {/* Decorative shortcuts: the heading link above is the accessible way in. */}
      <ul aria-hidden className="grid grid-cols-3 gap-1 sm:grid-cols-6 sm:gap-2">
        {photos.map((photo) => (
          <li key={photo.id}>
            <Link
              href="/gallery"
              tabIndex={-1}
              className="group block aspect-square overflow-hidden rounded-md bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Google already serves a resized copy */}
              <img
                src={drivePhotoUrl(photo.id, 400)}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Link out to the Google Drive album. */
export function GalleryLink({ url }: { url: string | null }) {
  if (!url) {
    return <EmptyState icon={Images} message="ยังไม่มีลิงก์ภาพกิจกรรม" />;
  }
  return (
    <div className="flex flex-col items-start gap-5 rounded-lg border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
      <div>
        <p className="eyebrow mb-1">Gallery</p>
        <p className="text-lg font-bold tracking-tight">
          ดูภาพบรรยากาศและภาพการแข่งขันทั้งหมด
        </p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-foreground px-5 text-sm font-semibold text-background transition-all hover:bg-foreground/85 active:scale-95"
      >
        เปิด Google Drive
        <ArrowUpRight aria-hidden className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        <span className="sr-only">(เปิดในแท็บใหม่)</span>
      </a>
    </div>
  );
}
