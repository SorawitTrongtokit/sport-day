import { Folder, Images } from "lucide-react";
import Link from "next/link";
import { drivePhotoUrl, type DriveAlbum } from "@/lib/drive";

export function AlbumGrid({ albums }: { albums: DriveAlbum[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {albums.map((album) => (
        <li key={album.id}>
          <AlbumCard album={album} />
        </li>
      ))}
    </ul>
  );
}

function AlbumCard({ album }: { album: DriveAlbum }) {
  return (
    <Link
      href={`/gallery/${album.id}`}
      className="group relative block aspect-[4/3] overflow-hidden rounded-lg border bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {album.cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- Google already serves a resized copy
        <img
          src={drivePhotoUrl(album.cover.id, 640)}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <Images aria-hidden className="absolute inset-0 m-auto size-8 text-muted-foreground" />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-10 text-white sm:p-4 sm:pt-12">
        <p className="line-clamp-2 font-bold leading-snug tracking-tight sm:text-lg">{album.name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-white/80 sm:text-sm">
          <span>{album.photoCount.toLocaleString("th-TH")} รูป</span>
          {album.albums.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Folder aria-hidden className="size-3.5" />
              {album.albums.length} อัลบั้มย่อย
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}
