import { Skeleton } from "@/components/ui/skeleton"

export default function DiscoverLoading() {
  return (
    <div className="min-h-full bg-stone-950 text-white">
      {/* Header skeleton */}
      <div className="sticky top-0 z-10 bg-stone-950/90 border-b border-white/5 px-6 lg:px-8 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <Skeleton className="h-8 w-32 bg-white/10" />
              <Skeleton className="h-4 w-48 mt-2 bg-white/5" />
            </div>
            <Skeleton className="h-10 w-64 rounded-xl bg-white/10" />
          </div>
          <div className="flex gap-2 pb-0.5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-7 w-20 rounded-full bg-white/10" />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-6 space-y-8">
        {/* Featured carousel skeleton */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-4 w-4 bg-amber-500/20 rounded-full" />
            <Skeleton className="h-4 w-24 bg-white/10" />
          </div>
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-64 w-full md:w-1/2 lg:w-1/4 rounded-2xl bg-white/5 shrink-0" />
            ))}
          </div>
        </section>

        {/* All companions skeleton */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-4 w-4 bg-amber-500/20 rounded-full" />
            <Skeleton className="h-4 w-32 bg-white/10" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <Skeleton key={i} className="h-56 rounded-2xl bg-white/5" />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
