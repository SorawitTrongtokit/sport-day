import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlbumTrail, GalleryContent } from "@/components/gallery/album-view";
import { findAlbum, isDriveId } from "@/lib/drive";
import { requirePageVisible } from "@/lib/queries/config";
import { getGallery } from "@/lib/queries/gallery";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ folderId: string }> };

/** Only folders inside the configured Drive folder can be shown, never any public folder. */
async function loadAlbum(folderId: string) {
  // Metadata runs this too, so a hidden gallery never reaches the Drive API.
  const config = await requirePageVisible("galleryPage");
  if (!isDriveId(folderId)) notFound();
  const gallery = await getGallery(config.galleryDriveUrl);
  // Without Drive access there are no albums, so the ID can't be one.
  if (gallery.status === "link-only") notFound();
  // Drive is down: the album may well exist, so offer the Drive link instead.
  if (gallery.status === "error") return { gallery, trail: null };
  const trail = findAlbum(gallery.root, folderId);
  if (!trail || trail.length < 2) notFound();
  return { gallery, trail };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { folderId } = await params;
  const { trail } = await loadAlbum(folderId);
  return { title: trail ? `${trail.at(-1)!.name} · Gallery` : "Gallery" };
}

export default async function AlbumPage({ params }: Props) {
  const { folderId } = await params;
  const { gallery, trail } = await loadAlbum(folderId);
  const album = trail?.at(-1);
  return (
    <>
      <header className="border-b bg-card">
        <div className="container-page py-8 sm:py-12">
          {trail && <AlbumTrail trail={trail} />}
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {album?.name ?? "ภาพกิจกรรม"}
          </h1>
          {album && (
            <p className="mt-2 text-muted-foreground">
              {album.photoCount.toLocaleString("th-TH")} รูป
            </p>
          )}
        </div>
      </header>
      <div className="container-page py-8">
        <GalleryContent gallery={gallery} album={album} />
      </div>
    </>
  );
}
