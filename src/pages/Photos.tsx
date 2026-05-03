import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useAddPhoto,
  useDeletePhoto,
  usePhotos,
  useUpdatePoseTag,
} from "@/hooks/usePhotos";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import type { Photo, PoseTag } from "@/db/db";
import { fmtDate } from "@/lib/format";
import { EmptyState, SectionHeader } from "@/components/ui-bits";
import { cn } from "@/lib/utils";
import { Trash2, GitCompare, Camera } from "lucide-react";

const POSES: { tag: PoseTag; label: string }[] = [
  { tag: "front", label: "Front" },
  { tag: "side", label: "Side" },
  { tag: "back", label: "Back" },
  { tag: "other", label: "Other" },
];

export default function Photos() {
  const { data: photos } = usePhotos();
  const add = useAddPhoto();
  const del = useDeletePhoto();
  const updateTag = useUpdatePoseTag();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pose, setPose] = useState<PoseTag>("front");
  const [filter, setFilter] = useState<PoseTag | "all">("all");
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const filtered = useMemo(
    () => (filter === "all" ? photos : photos.filter((p) => p.poseTag === filter)),
    [photos, filter],
  );

  const onPick = () => fileRef.current?.click();

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const allFiles = Array.from(files);
    const imageFiles = allFiles.filter((f) => f.type.startsWith("image/"));
    const skippedCount = allFiles.length - imageFiles.length;

    if (imageFiles.length === 0) {
      toast.error("No image files selected. Supported: JPEG, PNG, WebP.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    let addedCount = 0;
    try {
      for (const f of imageFiles) {
        await add.run({ file: f, poseTag: pose });
        addedCount++;
      }
      toast.success(
        addedCount === 1 ? "Photo added" : `${addedCount} photos added`,
      );
      if (skippedCount > 0) {
        toast.warning(
          `${skippedCount} file${skippedCount > 1 ? "s" : ""} skipped — not an image`,
        );
      }
    } catch (e) {
      if (addedCount > 0) {
        toast.warning(
          `${addedCount} photo${addedCount > 1 ? "s" : ""} added, but one failed`,
        );
      }
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggleCompare = (id: string) => {
    setCompareIds((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 2) return [cur[1], id];
      return [...cur, id];
    });
  };

  const compareA = compareIds[0]
    ? photos.find((p) => p.id === compareIds[0])
    : undefined;
  const compareB = compareIds[1]
    ? photos.find((p) => p.id === compareIds[1])
    : undefined;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Photos
          </h1>
          <p className="text-sm text-muted-foreground">
            Stored on this device only. Compressed to ~1600px.
          </p>
        </div>
        <button
          onClick={onPick}
          className="btn-primary"
          disabled={add.isSubmitting}
        >
          <Camera className="h-4 w-4" />
          {add.isSubmitting ? "Adding…" : "Add photo"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </header>

      {/* Pose selection and filter controls */}
      <div className="card-surface space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Pose for new:
          </span>
          {POSES.map((p) => (
            <Chip
              key={p.tag}
              active={pose === p.tag}
              onClick={() => setPose(p.tag)}
            >
              {p.label}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Filter:
          </span>
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </Chip>
          {POSES.map((p) => (
            <Chip
              key={p.tag}
              active={filter === p.tag}
              onClick={() => setFilter(p.tag)}
            >
              {p.label}
            </Chip>
          ))}
        </div>
      </div>

      {/* Compare partial state — one photo selected, prompt to pick another */}
      {compareIds.length === 1 && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand/10 px-4 py-2.5"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm text-brand-dark">
            1 photo selected — tap{" "}
            <GitCompare className="inline h-3.5 w-3.5 align-text-bottom" /> on
            another to compare
          </p>
          <button
            type="button"
            onClick={() => setCompareIds([])}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      {/* Compare pane — only shown when both slots are filled */}
      {compareA && compareB && (
        <section>
          <SectionHeader
            title="Compare"
            action={
              <button
                onClick={() => setCompareIds([])}
                className="btn-ghost text-xs"
              >
                Clear
              </button>
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <ComparePane photo={compareA} label="A" />
            <ComparePane photo={compareB} label="B" />
          </div>
        </section>
      )}

      <section>
        <SectionHeader
          title={`${filtered.length} photo${filtered.length === 1 ? "" : "s"}`}
        />
        {filtered.length === 0 ? (
          <EmptyState
            title={filter === "all" ? "No photos yet" : `No ${filter} photos`}
            description={
              filter === "all"
                ? "Add a front, side, or back photo to start a visual record."
                : "Try a different filter or add a new photo with this pose."
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filtered.map((p) => {
              const compareIdx = compareIds.indexOf(p.id);
              const compareLabel =
                compareIdx === 0 ? "A" : compareIdx === 1 ? "B" : undefined;
              return (
                <PhotoCard
                  key={p.id}
                  photo={p}
                  selected={compareIds.includes(p.id)}
                  compareLabel={compareLabel}
                  onCompare={() => toggleCompare(p.id)}
                  onDelete={async () => {
                    if (!confirm("Delete this photo?")) return;
                    try {
                      await del.run(p.id);
                      // If deleted photo was in compare, remove it.
                      setCompareIds((cur) => cur.filter((x) => x !== p.id));
                      toast.success("Photo deleted");
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Delete failed",
                      );
                    }
                  }}
                  onChangePose={(tag) => updateTag.run(p.id, tag)}
                />
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function PhotoCard({
  photo,
  selected,
  compareLabel,
  onCompare,
  onDelete,
  onChangePose,
}: {
  photo: Photo;
  selected: boolean;
  compareLabel?: "A" | "B";
  onCompare: () => void;
  onDelete: () => void;
  onChangePose: (tag: PoseTag) => void;
}) {
  const url = useObjectUrl(photo.blob);
  return (
    <li
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card shadow-soft transition-all duration-200",
        selected
          ? "border-brand ring-2 ring-brand/40"
          : "border-border hover:border-brand hover:shadow-soft-md",
      )}
    >
      <div className="relative aspect-[3/4] w-full bg-surface-secondary">
        {url && (
          <img
            src={url}
            alt={`Body photo, ${photo.poseTag}, ${fmtDate(photo.recordedAt)}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        )}
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{ backgroundColor: "rgba(15, 23, 42, 0.4)" }}
        />
        {/* Compare position badge */}
        {compareLabel && (
          <div
            className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white shadow"
            aria-label={`Compare position ${compareLabel}`}
          >
            {compareLabel}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 p-2.5 text-[11px]">
        <div className="min-w-0">
          <div className="font-semibold uppercase tracking-[0.14em] text-foreground">
            {photo.poseTag}
          </div>
          <div className="text-muted-foreground">{fmtDate(photo.recordedAt)}</div>
        </div>
        <div className="flex items-center gap-1">
          <select
            value={photo.poseTag}
            onChange={(e) => onChangePose(e.target.value as PoseTag)}
            className="rounded-lg border border-border bg-background px-1.5 py-1 text-[10px] font-medium text-foreground transition-colors hover:border-brand focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            aria-label="Change pose tag"
          >
            {POSES.map((p) => (
              <option key={p.tag} value={p.tag}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onCompare}
            className={cn(
              "rounded-lg border p-1.5 transition-colors",
              selected
                ? "border-brand bg-brand/10 text-brand-dark"
                : "border-border text-muted-foreground hover:border-brand hover:text-brand-dark",
            )}
            aria-label={selected ? "Remove from compare" : "Add to compare"}
            aria-pressed={selected}
          >
            <GitCompare className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-border p-1.5 text-destructive transition-colors hover:border-destructive/50 hover:bg-destructive/10"
            aria-label="Delete photo"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

function ComparePane({ photo, label }: { photo: Photo; label: "A" | "B" }) {
  const url = useObjectUrl(photo.blob);
  return (
    <div className="card-surface overflow-hidden p-0">
      <div className="relative aspect-[3/4] bg-surface-secondary">
        {url && (
          <img
            src={url}
            alt={`Compare ${label}: ${photo.poseTag} ${fmtDate(photo.recordedAt)}`}
            className="h-full w-full object-cover"
          />
        )}
        <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white shadow">
          {label}
        </div>
      </div>
      <div className="p-2.5 text-[11px] text-muted-foreground">
        <span className="font-semibold uppercase tracking-[0.14em] text-foreground">
          {photo.poseTag}
        </span>{" "}
        · {fmtDate(photo.recordedAt)}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("chip", active && "chip-active")}
    >
      {children}
    </button>
  );
}
