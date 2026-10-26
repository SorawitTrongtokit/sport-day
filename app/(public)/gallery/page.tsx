import type { Metadata } from "next";
import { GalleryContent } from "@/components/gallery/album-view";
import { PageHeader } from "@/components/shared/section-heading";
import { getSiteConfig, requirePageVisible } from "@/lib/queries/config";
import { getGallery } from "@/lib/queries/gallery";

export const metadata: Metadata = { title: "Gallery" };
export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  await requirePageVisible("galleryPage");
  const config = await getSiteConfig();
  const gallery = await getGallery(config.galleryDriveUrl);
  return (
    <>
      <PageHeader
        eyebrow="Gallery"
        title="ภาพกิจกรรม"
        description="ภาพบรรยากาศและภาพการแข่งขันทั้งหมด"
      />
      <div className="container-page py-8">
        <GalleryContent gallery={gallery} />
      </div>
    </>
  );
}
