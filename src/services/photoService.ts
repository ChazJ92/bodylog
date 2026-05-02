import imageCompression from "browser-image-compression";
import { db, type Photo, type PoseTag } from "@/db/db";
import { dateKeyFromRecordedAt } from "@/db/dateKey";
import { newId } from "@/lib/ids";
import {
  ALLOWED_PHOTO_MIME,
  photoPreCompressionSchema,
} from "@/lib/validationSchemas";

const COMPRESS_OPTS = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
  fileType: "image/jpeg" as const,
  initialQuality: 0.82,
};

async function readImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function addPhoto(args: {
  file: File;
  poseTag: PoseTag;
  recordedAt?: number;
  checkinId?: string;
}): Promise<Photo> {
  // Service-boundary validation: explicit allowed mime + max size before
  // we hand the file to the compressor (so we never spin the worker on
  // payloads we'd reject anyway).
  const parsed = photoPreCompressionSchema.safeParse({
    mimeType: args.file.type,
    byteSize: args.file.size,
  });
  if (!parsed.success) {
    if (!ALLOWED_PHOTO_MIME.includes(args.file.type as typeof ALLOWED_PHOTO_MIME[number])) {
      throw new Error(
        `Unsupported image type${args.file.type ? `: ${args.file.type}` : ""}. Allowed: JPEG, PNG, WebP.`,
      );
    }
    throw new Error("Photo exceeds the 10 MB limit. Try a smaller file.");
  }

  const compressed = await imageCompression(args.file, COMPRESS_OPTS);
  const { width, height } = await readImageDimensions(compressed);
  // Compression deliberately converts to JPEG (see COMPRESS_OPTS.fileType);
  // store that consistently. Fall back if the compressor produced an empty
  // type for any reason.
  const mimeType = compressed.type || "image/jpeg";
  const recordedAt = args.recordedAt ?? Date.now();
  const photo: Photo = {
    id: newId(),
    checkinId: args.checkinId,
    recordedAt,
    dateKey: dateKeyFromRecordedAt(recordedAt),
    poseTag: args.poseTag,
    blob: compressed,
    width,
    height,
    byteSize: compressed.size,
    mimeType,
    createdAt: Date.now(),
  };
  await db.photos.put(photo);
  return photo;
}

export const listAll = () =>
  db.photos.orderBy("recordedAt").reverse().toArray();

export const listByPose = (poseTag: PoseTag) =>
  db.photos.where("poseTag").equals(poseTag).reverse().sortBy("recordedAt");

export const listByCheckin = (checkinId: string) =>
  db.photos.where("checkinId").equals(checkinId).toArray();

export async function deletePhoto(id: string): Promise<void> {
  await db.photos.delete(id);
}

export async function updatePoseTag(id: string, poseTag: PoseTag): Promise<void> {
  await db.photos.update(id, { poseTag });
}
