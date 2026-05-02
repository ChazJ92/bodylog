import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAddPhoto, useDeletePhoto, usePhotos, useUpdatePoseTag } from "@/hooks/usePhotos";
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
    try {
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) continue;
        await add.run({ file: f, poseTag: pose });
      }
      toast.success("Photo added");
    } catch (e) {
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

  const compareA = compareIds[0] ? photos.find((p) => p.id === compareIds[0]) : undefined;
  const compareB = compareIds[1] ? photos.find((p) => p.id === compareIds[1]) : undefined;

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl">Photos</h1>
          <p className="font-sans text-sm text-muted-foreground mt-1">
            Stored on this device only. Compressed to ~1600px.
          </p>
        </div>
        <button
          onClick={onPick}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm text-background font-sans disabled:opacity-50"
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

      <div className="flex flex-wrap items-center gap-3 font-sans text-xs">
        <span className="uppercase tracking-[0.18em] text-muted-foreground">Pose for new:</span>
        {POSES.map((p) => (
          <button
            key={p.tag}
            type="button"
            onClick={() => setPose(p.tag)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.15em]",
              pose === p.tag ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 font-sans text-xs">
        <span className="uppercase tracking-[0.18em] text-muted-foreground mr-1">Filter:</span>
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>All</FilterChip>
        {POSES.map((p) => (
          <FilterChip key={p.tag} active={filter === p.tag} onClick={() => setFilter(p.tag)}>
            {p.label}
          </FilterChip>
        ))}
      </div>

      {compareA && compareB && (
        <section>
          <SectionHeader
            title="Compare"
            action={
              <button
                onClick={() => setCompareIds([])}
                className="font-sans text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <ComparePane photo={compareA} />
            <ComparePane photo={compareB} />
          </div>
        </section>
      )}

      <section>
        <SectionHeader title={`${filtered.length} photo${filtered.length === 1 ? "" : "s"}`} />
        {filtered.length === 0 ? (
          <EmptyState title="No photos yet" description="Add a front, side, or back photo to start a visual record." />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filtered.map((p) => (
              <PhotoCard
                key={p.id}
                photo={p}
                selected={compareIds.includes(p.id)}
                onCompare={() => toggleCompare(p.id)}
                onDelete={async () => {
                  if (!confirm("Delete this photo?")) return;
                  await del.run(p.id);
                }}
                onChangePose={(tag) => updateTag.run(p.id, tag)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PhotoCard({
  photo,
  selected,
  onCompare,
  onDelete,
  onChangePose,
}: {
  photo: Photo;
  selected: boolean;
  onCompare: () => void;
  onDelete: () => void;
  onChangePose: (tag: PoseTag) => void;
}) {
  const url = useObjectUrl(photo.blob);
  return (
    <li
      className={cn(
        "group relative overflow-hidden rounded-md border bg-card",
        selected ? "border-accent ring-2 ring-accent" : "border-border/60",
      )}
    >
      <div className="aspect-[3/4] w-full bg-secondary">
        {url && (
          <img
            src={url}
            alt={`Body photo, ${photo.poseTag}, ${fmtDate(photo.recordedAt)}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
      </div>
      <div className="flex items-center justify-between p-2 font-sans text-[11px]">
        <div>
          <div className="uppercase tracking-[0.15em] text-muted-foreground">{photo.poseTag}</div>
          <div className="text-muted-foreground">{fmtDate(photo.recordedAt)}</div>
        </div>
        <div className="flex items-center gap-1">
          <select
            value={photo.poseTag}
            onChange={(e) => onChangePose(e.target.value as PoseTag)}
            className="rounded border border-border bg-background px-1 py-0.5 text-[10px]"
            aria-label="Change pose tag"
          >
            {POSES.map((p) => (
              <option key={p.tag} value={p.tag}>{p.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={onCompare}
            className="rounded border border-border p-1 hover:bg-secondary"
            aria-label="Toggle compare"
          >
            <GitCompare className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded border border-border p-1 text-destructive hover:bg-destructive/10"
            aria-label="Delete photo"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

function ComparePane({ photo }: { photo: Photo }) {
  const url = useObjectUrl(photo.blob);
  return (
    <div className="rounded-md border border-border/60 bg-card overflow-hidden">
      <div className="aspect-[3/4] bg-secondary">
        {url && <img src={url} alt={`${photo.poseTag} ${fmtDate(photo.recordedAt)}`} className="h-full w-full object-cover" />}
      </div>
      <div className="p-2 font-sans text-[11px] text-muted-foreground">
        <span className="uppercase tracking-[0.15em]">{photo.poseTag}</span> · {fmtDate(photo.recordedAt)}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.15em]",
        active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
