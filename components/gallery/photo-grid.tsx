"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { driveFileUrl, drivePhotoUrl, type DrivePhoto } from "@/lib/drive";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 48;
const THUMB_WIDTH = 480;
const FULL_WIDTH = 2048;

/** Square thumbnails that open a full-screen viewer; long albums load in pages. */
export function PhotoGrid({ photos }: { photos: DrivePhoto[] }) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const [open, setOpen] = useState<number | null>(null);
  const remaining = photos.length - shown;

  return (
    <>
      <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-2 lg:grid-cols-5">
        {photos.slice(0, shown).map((photo, index) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setOpen(index)}
              className="group relative block aspect-square w-full overflow-hidden rounded-md bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Google already serves a resized copy */}
              <img
                src={drivePhotoUrl(photo.id, THUMB_WIDTH)}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="sr-only">ดูรูป {photo.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setShown((count) => count + PAGE_SIZE)}
            className="inline-flex h-11 items-center gap-2 rounded-md border bg-card px-5 text-sm font-semibold transition-all hover:border-foreground active:scale-95"
          >
            แสดงรูปเพิ่ม (อีก {remaining.toLocaleString("th-TH")} รูป)
            <ChevronDown aria-hidden className="size-4" />
          </button>
        </div>
      )}
      <Lightbox
        photos={photos}
        index={open}
        onIndexChange={(index) => {
          setOpen(index);
          // Keep the photo being viewed in the grid when the viewer closes.
          if (index !== null && index >= shown) setShown(index + 1);
        }}
      />
    </>
  );
}

function Lightbox({
  photos,
  index,
  onIndexChange,
}: {
  photos: DrivePhoto[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
}) {
  // The last photo stays rendered while the closing animation plays.
  const [last, setLast] = useState(0);
  if (index !== null && index !== last) setLast(index);
  const current = index ?? last;
  const photo = photos[current];
  const [loaded, setLoaded] = useState<string | null>(null);
  const touchStart = useRef<number | null>(null);

  const go = (step: number) => {
    if (index === null) return;
    onIndexChange((index + step + photos.length) % photos.length);
  };

  // Warm the cache for both neighbours so arrowing through feels instant.
  useEffect(() => {
    if (index === null || photos.length < 2) return;
    for (const step of [1, -1]) {
      const neighbour = photos[(index + step + photos.length) % photos.length];
      new Image().src = drivePhotoUrl(neighbour.id, FULL_WIDTH);
    }
  }, [index, photos]);

  if (!photo) return null;
  const many = photos.length > 1;

  return (
    <Dialog.Root open={index !== null} onOpenChange={(open) => !open && onIndexChange(null)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup
          className="fixed inset-0 z-50 flex flex-col text-white outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98] data-closed:animate-out data-closed:fade-out-0"
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") go(1);
            else if (event.key === "ArrowLeft") go(-1);
          }}
          onTouchStart={(event) => {
            touchStart.current = event.touches[0].clientX;
          }}
          onTouchEnd={(event) => {
            if (touchStart.current === null) return;
            const distance = event.changedTouches[0].clientX - touchStart.current;
            touchStart.current = null;
            if (Math.abs(distance) > 50) go(distance < 0 ? 1 : -1);
          }}
        >
          <div className="flex items-center gap-3 px-3 py-2 sm:px-5 sm:py-3">
            <Dialog.Title className="min-w-0 flex-1 truncate text-sm text-white/80">
              <span className="font-semibold text-white tabular-nums">
                {current + 1} / {photos.length}
              </span>
              <span className="ml-3 hidden sm:inline">{photo.name}</span>
            </Dialog.Title>
            <a
              href={driveFileUrl(photo.id)}
              target="_blank"
              rel="noopener noreferrer"
              className={toolbarButton}
            >
              <ExternalLink aria-hidden className="size-5" />
              <span className="sr-only">เปิดรูปนี้ใน Google Drive (แท็บใหม่)</span>
            </a>
            <Dialog.Close className={toolbarButton}>
              <X aria-hidden className="size-6" />
              <span className="sr-only">ปิด</span>
            </Dialog.Close>
          </div>

          <div className="relative min-h-0 flex-1">
            {/* The thumbnail is already cached, so it shows at once while the large copy loads. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- Google already serves a resized copy */}
            <img
              src={drivePhotoUrl(photo.id, THUMB_WIDTH)}
              alt=""
              referrerPolicy="no-referrer"
              className={cn(
                "absolute inset-0 size-full object-contain blur-sm",
                loaded === photo.id && "invisible",
              )}
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- Google already serves a resized copy */}
            <img
              key={photo.id}
              src={drivePhotoUrl(photo.id, FULL_WIDTH)}
              alt={photo.name}
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(photo.id)}
              className={cn(
                "absolute inset-0 size-full object-contain transition-opacity duration-200",
                loaded === photo.id ? "opacity-100" : "opacity-0",
              )}
            />
            {many && (
              <>
                <button type="button" onClick={() => go(-1)} className={cn(navButton, "left-2 sm:left-4")}>
                  <ChevronLeft aria-hidden className="size-7" />
                  <span className="sr-only">รูปก่อนหน้า</span>
                </button>
                <button type="button" onClick={() => go(1)} className={cn(navButton, "right-2 sm:right-4")}>
                  <ChevronRight aria-hidden className="size-7" />
                  <span className="sr-only">รูปถัดไป</span>
                </button>
              </>
            )}
          </div>
          {many && <p className="py-2 text-center text-xs text-white/50 sm:hidden">ปัดซ้าย-ขวาเพื่อเลื่อนรูป</p>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const toolbarButton =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none";

const navButton =
  "absolute top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none sm:inline-flex";
