export default function ProtectedLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando dados">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-2">
          <div className="h-7 w-40 animate-pulse rounded-md bg-slate-200" />
          <div className="h-4 w-72 animate-pulse rounded-md bg-slate-200" />
        </div>
        <div className="h-10 w-36 animate-pulse rounded-lg bg-slate-200" />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
              </div>
              <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
