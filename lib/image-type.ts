export type ImageType = "image/png" | "image/jpeg" | "image/webp";

/** Identifies PNG, JPEG and WebP by their file signature, ignoring the claimed MIME type. */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const startsWith = (signature: number[], offset = 0) =>
    signature.every((byte, i) => bytes[offset + i] === byte);

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  // "RIFF" <size> "WEBP"
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

export type UploadType = ImageType | "application/pdf";

/** Like detectImageType, but also accepts PDF documents ("%PDF-"). */
export function detectUploadType(bytes: Uint8Array): UploadType | null {
  const isPdf = [0x25, 0x50, 0x44, 0x46, 0x2d].every((byte, i) => bytes[i] === byte);
  return detectImageType(bytes) ?? (isPdf ? "application/pdf" : null);
}
