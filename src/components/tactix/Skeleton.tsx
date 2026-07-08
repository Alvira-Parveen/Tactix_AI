import type { CSSProperties } from "react";

/** Shimmer skeleton block. Uses the `skeleton` @utility from styles.css. */
export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div aria-hidden className={`skeleton rounded ${className}`} style={style} />;
}

/** Skeleton stand-in for a fixture card on the Match Hub. */
export function FixtureCardSkeleton() {
  return (
    <div
      className="flex flex-col gap-4 rounded-xl border p-5"
      style={{ borderColor: "#eceae4", backgroundColor: "#f7f4ed" }}
    >
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-col items-center gap-1.5">
          <Skeleton className="size-11 rounded-full" />
          <Skeleton className="h-3 w-14" />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-2.5 w-10" />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <Skeleton className="size-11 rounded-full" />
          <Skeleton className="h-3 w-14" />
        </div>
      </div>
      <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: "#eceae4" }}>
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-2.5 w-24" />
      </div>
    </div>
  );
}

/** Full-page skeleton for the fixtures list. */
export function FixturesPageSkeleton() {
  return (
    <div className="theme-cream min-h-screen">
      <div className="mx-auto max-w-[1200px] px-6 pt-10">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-3 h-4 w-96" />
        <section className="mt-10">
          <div className="mb-6 flex items-baseline justify-between">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <FixtureCardSkeleton key={i} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
