import Dexie, { type Table } from "dexie";

export type Sex = "male" | "female" | "other";
export type WeightUnit = "kg" | "lb";
export type LengthUnit = "cm" | "in";

export interface Profile {
  id: "me";
  sex: Sex;
  heightCm?: number;
  birthYear?: number;
  updatedAt: number;
}

export interface Settings {
  id: "app";
  weightUnit: WeightUnit;
  lengthUnit: LengthUnit;
  createdAt: number;
  updatedAt: number;
}

export interface Checkin {
  id: string;
  recordedAt: number; // ms since epoch
  weightKg?: number;
  bodyFatPct?: number; // user-entered, 0-100
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MeasurementType {
  id: string;
  name: string; // e.g. "waist"
  unit: "cm"; // canonical
  isBuiltIn: boolean;
  isActive: boolean; // soft-delete via false
  sortOrder: number;
  createdAt: number;
}

export interface Measurement {
  id: string;
  checkinId: string;
  measurementTypeId: string;
  valueCm: number;
  recordedAt: number; // mirrors checkin for fast querying
  createdAt: number;
}

export type PoseTag = "front" | "side" | "back" | "other";

export interface Photo {
  id: string;
  checkinId?: string;
  recordedAt: number;
  poseTag: PoseTag;
  blob: Blob;
  width: number;
  height: number;
  byteSize: number;
  mimeType: string;
  createdAt: number;
}

class BodyTrackDB extends Dexie {
  profile!: Table<Profile, "me">;
  settings!: Table<Settings, "app">;
  checkins!: Table<Checkin, string>;
  measurementTypes!: Table<MeasurementType, string>;
  measurements!: Table<Measurement, string>;
  photos!: Table<Photo, string>;

  constructor() {
    super("body-track");
    this.version(1).stores({
      profile: "id, updatedAt",
      settings: "id, updatedAt",
      checkins: "id, recordedAt, createdAt",
      measurementTypes: "id, name, isActive, sortOrder",
      measurements: "id, checkinId, measurementTypeId, recordedAt, [measurementTypeId+recordedAt]",
      photos: "id, checkinId, recordedAt, poseTag",
    });
  }
}

export const db = new BodyTrackDB();

const BUILT_IN_TYPES: Omit<MeasurementType, "createdAt">[] = [
  { id: "neck", name: "Neck", unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 10 },
  { id: "chest", name: "Chest", unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 20 },
  { id: "waist", name: "Waist", unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 30 },
  { id: "hip", name: "Hip", unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 40 },
  { id: "thigh", name: "Thigh", unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 50 },
  { id: "arm", name: "Arm", unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 60 },
];

let seedPromise: Promise<void> | null = null;
export function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const now = Date.now();
      const settings = await db.settings.get("app");
      if (!settings) {
        await db.settings.put({
          id: "app",
          weightUnit: "kg",
          lengthUnit: "cm",
          createdAt: now,
          updatedAt: now,
        });
      }
      const profile = await db.profile.get("me");
      if (!profile) {
        await db.profile.put({ id: "me", sex: "other", updatedAt: now });
      }
      const typeCount = await db.measurementTypes.count();
      if (typeCount === 0) {
        await db.measurementTypes.bulkPut(
          BUILT_IN_TYPES.map((t) => ({ ...t, createdAt: now })),
        );
      }
    })();
  }
  return seedPromise;
}
