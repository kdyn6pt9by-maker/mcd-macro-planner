"use client";

/** Shown instead of a blank screen if a page crashes: the error text (to screenshot) and a reload. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="max-w-md mx-auto px-5 min-h-screen flex flex-col justify-center gap-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
      <div className="text-4xl">⚠️</div>
      <h1 className="text-xl font-black">Something went wrong · صار خطأ</h1>
      <p className="text-sm text-muted">Your data is safe. Screenshot this and send it. · بياناتك محفوظة. صوّر هالشاشة وأرسلها.</p>
      <pre className="text-[11px] whitespace-pre-wrap break-words rounded-xl bg-black/40 p-3 text-[#ff8a7d]">
        {error.message}
        {"\n"}
        {(error.stack ?? "").split("\n").slice(0, 6).join("\n")}
      </pre>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={reset} className="rounded-xl bg-white/10 py-3 font-bold">Try again · حاول</button>
        <button onClick={() => window.location.replace(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`)} className="rounded-xl bg-gold text-black py-3 font-black">Reload · أعد التحميل</button>
      </div>
    </main>
  );
}
