/** Pure helpers for the Google Drive gallery; the fetching lives in lib/queries/gallery.ts. */

export type DrivePhoto = {
  id: string;
  name: string;
  width: number | null;
  height: number | null;
};

/** A Drive folder. Its subfolders become nested albums. */
export type DriveAlbum = {
  id: string;
  name: string;
  photos: DrivePhoto[];
  albums: DriveAlbum[];
  /** Photos in this album and every album below it. */
  photoCount: number;
  /** First photo of the album, or of its first album that has one. */
  cover: DrivePhoto | null;
};

// Drive IDs are URL-safe base64; checking the shape also keeps them safe to put in a query.
const DRIVE_ID = /^[A-Za-z0-9_-]{10,100}$/;

export function isDriveId(value: string): boolean {
  return DRIVE_ID.test(value);
}

/**
 * The folder ID from a shared folder link, e.g. drive.google.com/drive/folders/<id>,
 * drive.google.com/drive/u/0/folders/<id>?usp=sharing or drive.google.com/open?id=<id>.
 */
export function parseDriveFolderId(link: string | null): string | null {
  if (!link) return null;
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.hostname !== "drive.google.com") return null;
  const id = /\/folders\/([^/]+)/.exec(url.pathname)?.[1] ?? url.searchParams.get("id");
  return id && isDriveId(id) ? id : null;
}

/** A resized copy served by Google; `width` is the longest edge it scales to. */
export function drivePhotoUrl(id: string, width: number): string {
  return `https://lh3.googleusercontent.com/d/${id}=w${width}`;
}

export function driveFileUrl(id: string): string {
  return `https://drive.google.com/file/d/${id}/view`;
}

export function driveFolderUrl(id: string): string {
  return `https://drive.google.com/drive/folders/${id}`;
}

/** Builds an album from its own photos and finished child albums. */
export function makeAlbum(
  id: string,
  name: string,
  photos: DrivePhoto[],
  albums: DriveAlbum[],
): DriveAlbum {
  return {
    id,
    name,
    photos,
    albums,
    photoCount: photos.length + albums.reduce((sum, album) => sum + album.photoCount, 0),
    cover: photos[0] ?? albums.find((album) => album.cover)?.cover ?? null,
  };
}

/** The album with this ID and the albums leading to it from the root (root first, album last). */
export function findAlbum(root: DriveAlbum, id: string): DriveAlbum[] | null {
  if (root.id === id) return [root];
  for (const album of root.albums) {
    const trail = findAlbum(album, id);
    if (trail) return [root, ...trail];
  }
  return null;
}

/** Up to `limit` photos for a preview, taking one cover per album before anything else. */
export function previewPhotos(root: DriveAlbum, limit: number): DrivePhoto[] {
  const picked = new Map<string, DrivePhoto>();
  for (const album of root.albums) {
    if (album.cover) picked.set(album.cover.id, album.cover);
  }
  const queue = [root];
  for (let album = queue.shift(); album; album = queue.shift()) {
    for (const photo of album.photos) picked.set(photo.id, photo);
    if (picked.size >= limit) break;
    queue.push(...album.albums);
  }
  return [...picked.values()].slice(0, limit);
}
