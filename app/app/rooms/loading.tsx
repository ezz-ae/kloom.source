import { Skeleton } from "@/components/ui/skeleton"

export default function RoomsLoading() {
  return (
    <div className="min-h-full bg-stone-950 text-white">
      {/* Header skeleton */}
      <div className="sticky top-0 z-10 bg-stone-950/90 border-b border-white/5 px-6 lg:px-8 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Skeleton className="h-8 w-32 bg-white/10" />
              <Skeleton className="h-4 w-64 mt-2 bg-white/5" />
            </div>
            <Skeleton className="h-9 w-32 rounded-xl bg-white/10" />
          </div>
          <div className="flex gap-2 pb-0.5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-7 w-20 rounded-full bg-white/10" />
            ))}
          </div>
        </div>
      </div>

      {/* Grid skeleton matching bento design */}
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-6 pb-24 lg:pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 auto-rows-max">
          {[1, 2, 3, 4, 5, 6, 7].map((i, index) => {
            const isFeatured = index % 5 === 0;
            return (
              <Skeleton 
                key={i} 
                className={`rounded-3xl border border-white/5 bg-white/5 ${
                  isFeatured ? "md:col-span-2 xl:col-span-2 md:row-span-2 h-[340px]" : "h-[220px]"
                }`} 
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
