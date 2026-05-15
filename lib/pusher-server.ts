import Pusher from "pusher";

export const pusherServer = new Pusher({
  appId:   process.env.PUSHER_APP_ID!,
  key:     process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret:  process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS:  true,
});

/**
 * Broadcast an event to every client connected to a room channel.
 * The `type` field becomes the Pusher event name; the rest is the payload.
 */
export function notifyRoom(roomCode: string, payload: { type: string; [key: string]: unknown }) {
  const { type, ...data } = payload;
  pusherServer.trigger(`room-${roomCode}`, type, data).catch(() => {});
}
