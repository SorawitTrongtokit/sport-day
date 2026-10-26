import "server-only";
import { makeAlbum, parseDriveFolderId, type DriveAlbum, type DrivePhoto } from "@/lib/drive";
import { cached, TAGS } from "./cache";

const FOLDER_MIME = "application/vnd.google-apps.folder";
// Bounds the Drive API calls a single refresh can make, however the folder is organised.
const MAX_DEPTH = 4;
const MAX_FOLDERS = 150;
// Listing every subfolder at once made Drive answer slowly enough to time out,
// so only a few requests run at a time, and a slow or throttled one is tried again.
const MAX_CONCURRENT = 6;
const ATTEMPTS = 3;
const TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 500;

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  imageMediaMetadata?: { width?: number; height?: number };
};

type DriveListing = { files?: DriveFile[]; nextPageToken?: string };

type Limit = <T>(task: () => Promise<T>) => Promise<T>;

/** Runs at most `max` tasks at a time; the rest wait in order. */
function limiter(max: number): Limit {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async (task) => {
    if (running < max) running++;
    // A finishing task hands its slot straight over, so `running` stays put.
    else await new Promise<void>((resolve) => waiting.push(resolve));
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else running--;
    }
  };
}

type Attempt = { body: DriveListing } | { error: unknown; retry: boolean };

async function attempt(url: URL): Promise<Attempt> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (response.ok) return { body: (await response.json()) as DriveListing };
    const error = new Error(`Drive API ${response.status}: ${(await response.text()).slice(0, 300)}`);
    // Throttling and outages pass; a bad key or a private folder does not.
    return { error, retry: response.status === 429 || response.status >= 500 };
  } catch (error) {
    // Timeouts and network failures.
    return { error, retry: true };
  }
}

async function request(url: URL, limit: Limit): Promise<DriveListing> {
  for (let tries = 1; ; tries++) {
    const result = await limit(() => attempt(url));
    if ("body" in result) return result.body;
    if (!result.retry || tries >= ATTEMPTS) throw result.error;
    await new Promise((resolve) => setTimeout(resolve, tries * RETRY_DELAY_MS));
  }
}

async function listFolder(folderId: string, apiKey: string, limit: Limit): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.search = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false and (mimeType = '${FOLDER_MIME}' or mimeType contains 'image/')`,
      fields: "nextPageToken,files(id,name,mimeType,imageMediaMetadata(width,height))",
      orderBy: "folder,name_natural",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      key: apiKey,
      ...(pageToken && { pageToken }),
    }).toString();
    const body = await request(url, limit);
    files.push(...(body.files ?? []));
    pageToken = body.nextPageToken;
  } while (pageToken);
  return files;
}

async function fetchAlbum(
  id: string,
  name: string,
  depth: number,
  budget: { folders: number },
  apiKey: string,
  limit: Limit,
): Promise<DriveAlbum> {
  const files = await listFolder(id, apiKey, limit);
  const photos: DrivePhoto[] = files
    .filter((file) => file.mimeType.startsWith("image/"))
    .map((file) => ({
      id: file.id,
      name: file.name,
      width: file.imageMediaMetadata?.width ?? null,
      height: file.imageMediaMetadata?.height ?? null,
    }));
  const folders = depth < MAX_DEPTH ? files.filter((file) => file.mimeType === FOLDER_MIME) : [];
  const allowed = folders.slice(0, Math.max(0, budget.folders));
  budget.folders -= allowed.length;
  const albums = await Promise.all(
    allowed.map((folder) =>
      fetchAlbum(folder.id, folder.name, depth + 1, budget, apiKey, limit),
    ),
  );
  return makeAlbum(id, name, photos, albums);
}

async function fetchDriveGallery(folderId: string): Promise<DriveAlbum> {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY!;
  const limit = limiter(MAX_CONCURRENT);
  return fetchAlbum(folderId, "Gallery", 0, { folders: MAX_FOLDERS }, apiKey, limit);
}

// Saving the settings clears the config tag, which also reloads the photos right away.
const getDriveGallery = cached(fetchDriveGallery, "drive-gallery", [TAGS.config]);

export type Gallery =
  | { status: "ok"; root: DriveAlbum; folderUrl: string }
  /** No API key or no usable folder link: fall back to the plain Drive link. */
  | { status: "link-only"; folderUrl: string | null }
  | { status: "error"; folderUrl: string };

export async function getGallery(driveUrl: string | null): Promise<Gallery> {
  const folderId = parseDriveFolderId(driveUrl);
  if (!folderId || !process.env.GOOGLE_DRIVE_API_KEY) {
    return { status: "link-only", folderUrl: driveUrl };
  }
  try {
    return { status: "ok", root: await getDriveGallery(folderId), folderUrl: driveUrl! };
  } catch (error) {
    console.error("Failed to load the Drive gallery", error);
    return { status: "error", folderUrl: driveUrl! };
  }
}
