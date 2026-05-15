/** Generates a single PNG collage for one hour bucket.
 *
 *  Layout mirrors the in-app grid:
 *    - capacity slots arranged in cols × rows
 *    - each slot shows the participant's photo (or a placeholder)
 *    - nickname badge top-left of every slot
 *    - hour label + app name in the header
 */

export interface CollageParticipant {
  slotIndex: number;
  nickname: string;
}

export interface CollageUpload {
  slotIndex: number;
  /** Use full-res url for downloads, thumbnailUrl for previews */
  url: string;
  /** Pan position 0–100 (default 50 = centre) */
  posX?: number;
  posY?: number;
}

// Fixed 4:5 canvas — suits Instagram portrait and most social media formats.
const CANVAS_W = 1080;
const CANVAS_H = 1350;
const GAP    = 16;  // gap between tiles
const PAD    = 28;  // outer padding
const HEADER = 64;  // height reserved for the hour label + app name

export async function generateCollage(
  participants: CollageParticipant[],
  uploads: CollageUpload[],
  cols: number,
  rows: number,
  hourLabel: string,
): Promise<Blob> {
  const W = CANVAS_W;
  const H = CANVAS_H;

  // Tiles are always 1:1 square — matching the live-grid tiles which are always square
  // regardless of layout (wrapper aspectRatio cols/rows divided by cols×rows cancels out).
  // Use the binding constraint (width or height) then centre the grid in the remaining space.
  const maxTileByW = (W - PAD * 2 - (cols - 1) * GAP) / cols;
  const maxTileByH = (H - PAD * 2 - HEADER - (rows - 1) * GAP) / rows;
  const tileSize   = Math.min(maxTileByW, maxTileByH); // square
  const tileW      = tileSize;
  const tileH      = tileSize;

  // Centre the grid horizontally and vertically within the available area
  const gridW  = cols * tileSize + (cols - 1) * GAP;
  const gridH  = rows * tileSize + (rows - 1) * GAP;
  const gridX  = (W - gridW) / 2;
  const gridY  = PAD + HEADER + (H - PAD * 2 - HEADER - gridH) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#171717";
  ctx.fillRect(0, 0, W, H);

  // Header — hour label
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(hourLabel, W / 2, PAD + HEADER / 2 - 6);

  // Sub-label — app name
  ctx.fillStyle = "#a3a3a3";
  ctx.font = "16px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("OneHourAPicture", W / 2, PAD + HEADER / 2 + 20);

  // Load images (thumbnail for preview, full for download — caller chooses url)
  const capacity = cols * rows;
  const images = await Promise.all(
    Array.from({ length: capacity }, (_, i) => {
      const upload = uploads.find((u) => u.slotIndex === i);
      if (!upload) return Promise.resolve(null);
      return loadImage(upload.url);
    }),
  );

  // Draw tiles
  for (let i = 0; i < capacity; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gridX + col * (tileSize + GAP);
    const y = gridY + row * (tileSize + GAP);

    const participant = participants.find((p) => p.slotIndex === i);
    const img = images[i];

    // Tile background
    ctx.fillStyle = "#262626";
    roundRect(ctx, x, y, tileW, tileH, 18);
    ctx.fill();

    if (img) {
      // Object-cover with pan: scale to fill tile, then offset by posX/posY
      ctx.save();
      roundRect(ctx, x, y, tileW, tileH, 18);
      ctx.clip();
      const scale = Math.max(tileW / img.width, tileH / img.height);
      const sw = img.width * scale;
      const sh = img.height * scale;
      const upload = uploads.find((u) => u.slotIndex === i);
      const pxPct = (upload?.posX ?? 50) / 100;
      const pyPct = (upload?.posY ?? 50) / 100;
      // Offset: 0% → image left/top aligned, 100% → image right/bottom aligned
      const imgX = x + (tileW - sw) * pxPct;
      const imgY = y + (tileH - sh) * pyPct;
      ctx.drawImage(img, imgX, imgY, sw, sh);
      ctx.restore();
    } else if (participant) {
      // No photo uploaded this hour
      ctx.fillStyle = "#404040";
      ctx.font = "20px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("no photo", x + tileW / 2, y + tileH / 2);
    }

    // Nickname badge
    if (participant) {
      ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const name = participant.nickname;
      const textW = ctx.measureText(name).width;
      const badgeW = textW + 20;
      const badgeH = 32;
      const bx = x + 12;
      const by = y + 12;

      ctx.fillStyle = "rgba(0,0,0,0.65)";
      roundRect(ctx, bx, by, badgeW, badgeH, 16);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.fillText(name, bx + 10, by + badgeH / 2);
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed"))),
      "image/png",
    );
  });
}

/** Trigger a native file save from a Blob. Works on modern iOS (≥15) and Android. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ── helpers ─────────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // missing photo → placeholder
    img.src = src;
    setTimeout(() => resolve(null), 12000); // 12s hard timeout
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
