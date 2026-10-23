export type Lang = "uz" | "ru";

// Shifokorning ruscha matnlari (hammasi ixtiyoriy: bo'sh bo'lsa o'zbekchasi ko'rsatiladi)
export type DoctorRu = {
  name?: string;
  role?: string;
  description?: string;
  bio?: string;
  experience?: string;
  education?: string;
  schedule?: string;
  address?: string;
};

export type Doctor = {
  id: string;
  name: string;
  role: string;
  description: string;
  image: string;
  phone: string;
  telegram: string;
  instagram?: string; // https://instagram.com/username
  accent: "neyro" | "cardio";
  // "Batafsil" oynasida ko'rinadigan ma'lumotlar (hammasi ixtiyoriy)
  bio?: string;
  experience?: string;
  education?: string;
  schedule?: string;
  address?: string;
  ru?: DoctorRu;
};

export type Video = {
  id: string; // YouTube video ID
  title: string;
  titleRu?: string;
  start?: number;
};

export type SiteData = {
  doctors: Doctor[];
  videos: Video[];
};

// Chatdagi xabar. Shifokor xabarida ism/rasm saytdagi joriy profildan olinadi (doctorId orqali).
export type ChatMessage = {
  id: string;
  kind: "patient" | "doctor";
  name: string;
  doctorId?: string;
  text: string;
  ts: number;
  replyTo?: { id: string; name: string; text: string };
  // Faqat serverda: bemorning Telegram ID si (javob kelganda xabar yuborish uchun). Saytga chiqarilmaydi.
  tgUser?: number;
  tgLang?: "uz" | "ru";
};

// Shifokor profili: chatda ko'rsatish uchun kerakli ochiq ma'lumotlar
export type ChatDoctor = Pick<Doctor, "id" | "name" | "role" | "image" | "accent" | "ru">;
