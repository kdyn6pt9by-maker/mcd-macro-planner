"use client";

/** Last-resort error screen (when even the layout fails). */
export default function GlobalError({ error }: { error: Error }) {
  return (
    <html>
      <body style={{ background: "#0b0405", color: "#f7ecec", fontFamily: "-apple-system, sans-serif", padding: "60px 20px" }}>
        <h1>⚠️ Something went wrong · صار خطأ</h1>
        <p>Your data is safe. Screenshot this and send it.</p>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "#ff8a7d" }}>{error.message + "\n" + (error.stack ?? "").split("\n").slice(0, 6).join("\n")}</pre>
        <button onClick={() => window.location.replace("/")} style={{ padding: 12, borderRadius: 12, background: "#ffc72c", border: 0, fontWeight: 900 }}>
          Reload
        </button>
      </body>
    </html>
  );
}
