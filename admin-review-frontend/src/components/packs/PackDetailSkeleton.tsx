export default function PackDetailSkeleton() {
  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-background-base">
      <div className="w-full max-w-[1440px] px-4 md:px-5 pt-4">
        <div className="w-24 h-8 bg-[rgba(63,71,84,0.24)] rounded-full animate-pulse" />
      </div>
      <div className="w-full h-[400px] bg-background-sunken border-x border-[rgba(63,71,84,0.24)] animate-pulse" />
      <div className="flex flex-col items-center gap-6 w-full max-w-4xl mx-auto px-4 py-6">
        <div className="w-48 h-6 bg-[rgba(63,71,84,0.24)] rounded animate-pulse" />
        <div className="w-full h-9 bg-[rgba(63,71,84,0.24)] rounded-lg animate-pulse" />
        <div className="flex flex-row gap-2 w-full">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[128px] h-[196px] bg-[rgba(63,71,84,0.24)] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
