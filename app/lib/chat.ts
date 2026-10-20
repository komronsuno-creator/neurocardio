// Chat xabarlari: har bir xabar alohida kalitda ("chat/m/<id>") saqlanadi.
// ID vaqt bo'yicha tartiblanadi, shuning uchun kalitlar ro'yxati — xabarlar tarixi.
import { randomBytes } from "crypto";
import { kvDelete, kvGet, kvList, kvSet } from "./store";
import type { ChatMessage } from "./types";

const PREFIX = "chat/m/";
export const MAX_KEEP = 400; // eng ko'p saqlanadigan xabarlar soni (eskilari o'chadi)
export const PAGE = 60; // birinchi ochilganda yuboriladigan xabarlar

export const newMessageId = () =>
  `${Date.now().toString(36).padStart(9, "0")}-${randomBytes(4).toString("hex")}`;
export const isMessageId = (id: string) => /^[0-9a-z]{9}-[0-9a-f]{8}$/.test(id);

export async function messageIds(): Promise<string[]> {
  return (await kvList(PREFIX)).map((k) => k.slice(PREFIX.length)).filter(isMessageId);
}

export async function getMessage(id: string): Promise<ChatMessage | null> {
  if (!isMessageId(id)) return null;
  return kvGet<ChatMessage>(PREFIX + id);
}

export async function getMessages(ids: string[]): Promise<ChatMessage[]> {
  const list = await Promise.all(ids.map((id) => getMessage(id)));
  return list.filter((m): m is ChatMessage => Boolean(m));
}

export async function saveMessage(msg: ChatMessage): Promise<void> {
  await kvSet(PREFIX + msg.id, msg);
}

export async function deleteMessage(id: string): Promise<boolean> {
  if (!isMessageId(id)) return false;
  const exists = await getMessage(id);
  if (!exists) return false;
  await kvDelete(PREFIX + id);
  return true;
}

/** Juda ko'payib ketsa eng eski xabarlarni o'chiradi. */
export async function prune(ids: string[]): Promise<void> {
  const extra = ids.length - MAX_KEEP;
  if (extra <= 0) return;
  await Promise.all(ids.slice(0, extra).map((id) => kvDelete(PREFIX + id)));
}
