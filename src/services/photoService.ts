import imageCompression from "browser-image-compression";
import { db, type Photo, type PoseTag } from "@/db/db";
import { newId } from "@/lib/ids";

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
  const compressed = await imageCompression(args.file, COMPRESS_OPTS);
  const { width, height } = await readImageDimensions(compressed);
  const photo: Photo = {
    id: newId(),
    checkinId: args.checkinId,
    recordedAt: args.recordedAt ?? Date.now(),
    poseTag: args.poseTag,
    blob: compressed,
    width,
    height,
    byteSize: compressed.size,
    mimeType: compressed.type || "image/jpeg",
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
