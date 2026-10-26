import { ArrowUpRight, ChevronRight, Images } from "lucide-react";
import Link from "next/link";
import { GalleryLink } from "@/components/home/gallery-cta";
import { EmptyState } from "@/components/shared/empty-state";
import type { DriveAlbum } from "@/lib/drive";
import type { Gallery } from "@/lib/queries/gallery";
import { AlbumGrid } from "./album-grid";
import { PhotoGrid } from "./photo-grid";

/** The albums and photos of one Drive folder, or the plain Drive link when they can't be loaded. */
export function GalleryContent({ gallery, album }: { gallery: Gallery; album?: DriveAlbum }) {
  if (gallery.status !== "ok") {
    return (
      <div className="space-y-3">
        <GalleryLink url={gallery.folderUrl} />
        {gallery.status === "error" && (
          <p className="text-sm text-muted-foreground">
            ตอนนี้โหลดรูปจาก Google Drive ไม่ได้ เปิดดูใน Drive แทนได้เลย
          </p>
        )}
      </div>
    );
  }

  const shown = album ?? gallery.root;
  return (
    <div className="space-y-10">
      {shown.albums.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold tracking-tight">อัลบั้ม</h2>
          <AlbumGrid albums={shown.albums} />
        </section>
      )}
      {shown.photos.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold tracking-tight">
            {shown.albums.length > 0 ? "รูปอื่น ๆ" : "รูปภาพ"}
            <span className="ml-2 text-base font-normal text-muted-foreground">
              {shown.photos.length.toLocaleString("th-TH")} รูป
            </span>
          </h2>
          <PhotoGrid photos={shown.photos} />
        </section>
      )}
      {shown.photoCount === 0 && <EmptyState icon={Images} message="ยังไม่มีรูปในอัลบั้มนี้" />}
      <a
        href={gallery.folderUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
      >
        เปิดโฟลเดอร์ทั้งหมดใน Google Drive
        <ArrowUpRight aria-hidden className="size-4" />
        <span className="sr-only">(เปิดในแท็บใหม่)</span>
      </a>
    </div>
  );
}

/** Gallery › parent album › … for an album page; the last album is the current page. */
export function AlbumTrail({ trail }: { trail: DriveAlbum[] }) {
  return (
    <nav aria-label="ตำแหน่งอัลบั้ม" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {trail.slice(0, -1).map((album, index) => (
          <li key={album.id} className="flex items-center gap-1">
            <Link
              href={index === 0 ? "/gallery" : `/gallery/${album.id}`}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              {index === 0 ? "Gallery" : album.name}
            </Link>
            <ChevronRight aria-hidden className="size-3.5" />
          </li>
        ))}
      </ol>
    </nav>
  );
}
