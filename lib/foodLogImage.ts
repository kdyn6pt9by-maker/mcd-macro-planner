import { Macros } from "./types";

export interface FoodLogDay {
  title: string;
  items: { label: string; qty: number; kcal: number }[];
  totals: Macros;
  target: number;
}

/** A tall shareable image: every food eaten on each day, with the day's calories and macros. */
export async function renderFoodLog(o: { title: string; subtitle: string; days: FoodLogDay[]; footer: string; rtl: boolean; labels: { p: string; f: string; c: string; kcal: string; none: string } }): Promise<Blob> {
  const W = 1080;
  const PAD = 70;
  const ROW = 50;
  const heights = o.days.map((d) => 190 + Math.max(1, d.items.length) * ROW);
  const H = 260 + heights.reduce((a, b) => a + b + 30, 0) + 90;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const font = (w: number, s: number) => `${w} ${s}px -apple-system, "SF Pro Display", "Segoe UI", Roboto, "Noto Sans Arabic", sans-serif`;
  ctx.direction = o.rtl ? "rtl" : "ltr";
  const startX = o.rtl ? W - PAD : PAD;
  const endX = o.rtl ? PAD : W - PAD;
  const startAlign: CanvasTextAlign = o.rtl ? "right" : "left";
  const endAlign: CanvasTextAlign = o.rtl ? "left" : "right";

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#2a0a0e");
  bg.addColorStop(1, "#0b0405");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = startAlign;
  ctx.fillStyle = "#ffc72c";
  ctx.font = font(900, 64);
  ctx.fillText(o.title, startX, 120);
  ctx.fillStyle = "#b39597";
  ctx.font = font(600, 32);
  ctx.fillText(o.subtitle, startX, 175);

  let y = 240;
  o.days.forEach((d, i) => {
    const h = heights[i];
    ctx.fillStyle = "rgba(58,16,20,0.9)";
    ctx.beginPath();
    ctx.roundRect(PAD - 30, y, W - 2 * (PAD - 30), h, 36);
    ctx.fill();
    // Day title + kcal
    ctx.textAlign = startAlign;
    ctx.fillStyle = "#f7ecec";
    ctx.font = font(900, 40);
    ctx.fillText(d.title, startX, y + 65);
    ctx.textAlign = endAlign;
    ctx.fillStyle = d.totals.kcal > d.target + 100 ? "#ff8a7d" : "#ffc72c";
    ctx.font = font(900, 40);
    ctx.fillText(`${Math.round(d.totals.kcal).toLocaleString("en-US")} / ${d.target.toLocaleString("en-US")} ${o.labels.kcal}`, endX, y + 65);
    // Macros line
    ctx.textAlign = startAlign;
    ctx.font = font(700, 30);
    ctx.fillStyle = "#34d399";
    ctx.fillText(`${o.labels.p} ${Math.round(d.totals.protein)}g   ${o.labels.f} ${Math.round(d.totals.fat)}g   ${o.labels.c} ${Math.round(d.totals.carbs)}g`, startX, y + 115);
    // Items
    let iy = y + 175;
    ctx.font = font(600, 30);
    if (!d.items.length) {
      ctx.fillStyle = "#b39597";
      ctx.fillText(o.labels.none, startX, iy);
    }
    for (const it of d.items) {
      ctx.textAlign = startAlign;
      ctx.fillStyle = "#e8d5d6";
      const label = `${it.qty > 1 ? `${it.qty}× ` : ""}${it.label}`;
      ctx.fillText(label.length > 42 ? label.slice(0, 41) + "…" : label, startX, iy);
      ctx.textAlign = endAlign;
      ctx.fillStyle = "#b39597";
      ctx.fillText(`${Math.round(it.kcal)}`, endX, iy);
      iy += ROW;
    }
    y += h + 30;
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(179,149,151,0.8)";
  ctx.font = font(600, 28);
  ctx.fillText(o.footer, W / 2, H - 40);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("render failed"))), "image/png"));
}
