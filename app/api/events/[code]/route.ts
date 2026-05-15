import { NextRequest } from "next/server";
import { sseClients } from "@/app/api/upload/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const roomCode = code.toUpperCase();

  const encoder = new TextEncoder();
  let send: (data: string) => void;

  const stream = new ReadableStream({
    start(controller) {
      send = (data: string) => controller.enqueue(encoder.encode(data));

      // Register client
      if (!sseClients.has(roomCode)) sseClients.set(roomCode, new Set());
      sseClients.get(roomCode)!.add(send);

      // Heartbeat every 25s to keep connection alive
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(": heartbeat\n\n")); }
        catch { clearInterval(heartbeat); }
      }, 25000);

      // Cleanup on disconnect
      _req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        sseClients.get(roomCode)?.delete(send);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
