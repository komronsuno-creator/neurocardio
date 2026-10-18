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
