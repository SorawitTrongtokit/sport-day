import { afterEach, describe, expect, it, vi } from "vitest";
import { findAlbum, makeAlbum, parseDriveFolderId, previewPhotos, type DrivePhoto } from "@/lib/drive";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

const FOLDER = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";

const photo = (id: string): DrivePhoto => ({ id, name: `${id}.jpg`, width: null, height: null });

describe("parseDriveFolderId", () => {
  it("reads the common folder link shapes", () => {
    expect(parseDriveFolderId(`https://drive.google.com/drive/folders/${FOLDER}`)).toBe(FOLDER);
    expect(parseDriveFolderId(`https://drive.google.com/drive/folders/${FOLDER}?usp=sharing`)).toBe(FOLDER);
    expect(parseDriveFolderId(`https://drive.google.com/drive/u/1/folders/${FOLDER}`)).toBe(FOLDER);
    expect(parseDriveFolderId(`https://drive.google.com/open?id=${FOLDER}`)).toBe(FOLDER);
  });

  it("rejects other hosts, malformed IDs and empty values", () => {
    expect(parseDriveFolderId(null)).toBeNull();
    expect(parseDriveFolderId("not a url")).toBeNull();
    expect(parseDriveFolderId(`https://example.com/drive/folders/${FOLDER}`)).toBeNull();
    expect(parseDriveFolderId("https://drive.google.com/drive/folders/abc' or '1")).toBeNull();
    expect(parseDriveFolderId("https://photos.app.goo.gl/xyz")).toBeNull();
  });
});

describe("albums", () => {
  const day1 = makeAlbum("day1", "Day 1", [photo("a"), photo("b")], []);
  const empty = makeAlbum("empty", "Empty", [], []);
  const nested = makeAlbum("nested", "Nested", [], [makeAlbum("deep", "Deep", [photo("c")], [])]);
  const root = makeAlbum("root", "Gallery", [photo("r")], [empty, day1, nested]);

  it("counts photos and picks covers through nested albums", () => {
    expect(root.photoCount).toBe(4);
    expect(nested.cover?.id).toBe("c");
    expect(empty.cover).toBeNull();
    expect(root.cover?.id).toBe("r");
  });

  it("finds the trail to a nested album, and nothing outside the tree", () => {
    expect(findAlbum(root, "deep")?.map((album) => album.id)).toEqual(["root", "nested", "deep"]);
    expect(findAlbum(root, "elsewhere")).toBeNull();
  });

  it("previews one cover per album before filling up", () => {
    expect(previewPhotos(root, 3).map((p) => p.id)).toEqual(["a", "c", "r"]);
    expect(previewPhotos(root, 10).map((p) => p.id)).toEqual(["a", "c", "r", "b"]);
  });
});

describe("getGallery", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const folder = (id: string, name: string) => ({
    id,
    name,
    mimeType: "application/vnd.google-apps.folder",
  });
  const image = (id: string) => ({
    id,
    name: `${id}.jpg`,
    mimeType: "image/jpeg",
    imageMediaMetadata: { width: 4000, height: 3000 },
  });

  it("falls back to the link without an API key", async () => {
    vi.stubEnv("GOOGLE_DRIVE_API_KEY", "");
    const { getGallery } = await import("@/lib/queries/gallery");
    const url = `https://drive.google.com/drive/folders/${FOLDER}`;
    expect(await getGallery(url)).toEqual({ status: "link-only", folderUrl: url });
  });

  it("walks subfolders and follows pagination", async () => {
    vi.stubEnv("GOOGLE_DRIVE_API_KEY", "test-key");
    const pages: Record<string, { files: unknown[]; nextPageToken?: string }> = {
      [`${FOLDER}:`]: { files: [folder("SUBFOLDER01", "วันแรก"), image("ROOTPHOTO1")], nextPageToken: "p2" },
      [`${FOLDER}:p2`]: { files: [image("ROOTPHOTO2")] },
      "SUBFOLDER01:": { files: [image("DAYONEPHOTO")] },
    };
    const fetchMock = vi.fn(async (input: URL) => {
      const parent = /'([^']+)' in parents/.exec(input.searchParams.get("q")!)![1];
      const body = pages[`${parent}:${input.searchParams.get("pageToken") ?? ""}`];
      return new Response(JSON.stringify(body));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getGallery } = await import("@/lib/queries/gallery");

    const gallery = await getGallery(`https://drive.google.com/drive/folders/${FOLDER}`);
    if (gallery.status !== "ok") throw new Error(`unexpected ${gallery.status}`);
    expect(gallery.root.photos.map((p) => p.id)).toEqual(["ROOTPHOTO1", "ROOTPHOTO2"]);
    expect(gallery.root.albums[0]).toMatchObject({ name: "วันแรก", photoCount: 1 });
    expect(gallery.root.photoCount).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reports an error instead of throwing when Drive refuses, without retrying", async () => {
    vi.stubEnv("GOOGLE_DRIVE_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => new Response("forbidden", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { getGallery } = await import("@/lib/queries/gallery");
    const gallery = await getGallery(`https://drive.google.com/drive/folders/${FOLDER}`);
    expect(gallery.status).toBe("error");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tries again after a timeout or a Drive outage", async () => {
    vi.stubEnv("GOOGLE_DRIVE_API_KEY", "test-key");
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("The operation was aborted due to timeout", "TimeoutError"))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [image("ROOTPHOTO1")] })));
    vi.stubGlobal("fetch", fetchMock);
    const { getGallery } = await import("@/lib/queries/gallery");

    const gallery = await getGallery(`https://drive.google.com/drive/folders/${FOLDER}`);
    if (gallery.status !== "ok") throw new Error(`unexpected ${gallery.status}`);
    expect(gallery.root.photoCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up after three tries", async () => {
    vi.stubEnv("GOOGLE_DRIVE_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { getGallery } = await import("@/lib/queries/gallery");

    const gallery = await getGallery(`https://drive.google.com/drive/folders/${FOLDER}`);
    expect(gallery.status).toBe("error");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("lists many subfolders a few at a time", async () => {
    vi.stubEnv("GOOGLE_DRIVE_API_KEY", "test-key");
    const subfolders = Array.from({ length: 20 }, (_, i) => folder(`SUBFOLDER${String(i).padStart(2, "0")}`, `Day ${i}`));
    let running = 0;
    let most = 0;
    const fetchMock = vi.fn(async (input: URL) => {
      running++;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      const parent = /'([^']+)' in parents/.exec(input.searchParams.get("q")!)![1];
      const files = parent === FOLDER ? subfolders : [image(`${parent}PHOTO`)];
      return new Response(JSON.stringify({ files }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getGallery } = await import("@/lib/queries/gallery");

    const gallery = await getGallery(`https://drive.google.com/drive/folders/${FOLDER}`);
    if (gallery.status !== "ok") throw new Error(`unexpected ${gallery.status}`);
    expect(gallery.root.albums).toHaveLength(20);
    expect(gallery.root.photoCount).toBe(20);
    expect(most).toBeGreaterThan(1);
    expect(most).toBeLessThanOrEqual(6);
  });
});
