// Sayt matnlari: o'zbekcha va ruscha.
// Yangi matn qo'shsangiz, ikkala tilga ham yozing (TypeScript ruschasi yetishmasa ogohlantiradi).
import type { Doctor, DoctorRu, Lang, Video } from "./types";

export const LANGS: Lang[] = ["uz", "ru"];
export const LANG_COOKIE = "lang";

const uz = {
  nav: {
    directions: "Yo‘nalishlar",
    doctors: "Shifokorlar",
    videos: "Videolar",
    contact: "Qabul",
    cta: "Qabulga yozilish",
    menuOpen: "Menyuni ochish",
    menuClose: "Menyuni yopish",
    theme: "Rejimni almashtirish",
    lang: "Tilni tanlash",
  },
  hero: {
    eyebrow: "MIYA · YURAK · SALOMATLIK",
    title1: "Sog‘lom hayot",
    title2: " ishonchli bilimdan",
    title3: "boshlanadi",
    text: "Nevrologiya, kardiologiya va umumiy salomatlik haqida shifokorlar tayyorlagan sodda va ishonchli ma’lumotlar.",
    cta: "Qabulga yozilish",
    videos: "Videolar",
    stat1: "Tibbiy videolar",
    stat2: "Mutaxassis",
    stat3: "Foydali bilimlar",
    chipNeuro: "Nevrologiya",
    chipCardio: "Kardiologiya",
  },
  trust: [
    { title: "Shifokorlar tayyorlagan", text: "Har bir ma’lumot mutaxassis tomonidan tushuntiriladi" },
    { title: "Ilmiy asosda", text: "Zamonaviy tibbiyot tavsiyalariga tayanadi" },
    { title: "Bepul va ochiq", text: "Videolar hamma uchun bepul" },
    { title: "Tez aloqa", text: "Shifokor bilan Telegram orqali bog‘laning" },
  ],
  directions: {
    tag: "YO‘NALISHLAR",
    title: "Salomatlik uchun muhim bilimlar",
    text: "Organizmni tushunish, sog‘lom odatlarni shakllantirish va kasalliklarning oldini olish haqida.",
    more: "Batafsil",
    items: [
      { title: "Nevrologiya", text: "Miya va asab tizimi salomatligi" },
      { title: "Kardiologiya", text: "Yurak va qon bosimi haqida" },
      { title: "Profilaktika", text: "Kasalliklarning oldini olish" },
      { title: "Uyqu va stress", text: "Sog‘lom uyqu va ruhiy salomatlik" },
    ],
  },
  doctors: {
    tag: "MUTAXASSISLAR",
    title: "Shifokorlarimiz",
    text: "Mutaxassislar bilan bog‘laning va o‘zingizga kerakli ma’lumotni oling.",
    call: "Qo‘ng‘iroq",
    more: "Batafsil",
  },
  videos: {
    tag: "VIDEO KUTUBXONASI",
    title: "Foydali tibbiy videolar",
    text: "NeyroCardio kanalidagi salomatlik haqidagi videolarni shu sahifaning o‘zida tomosha qiling.",
    label: "NEYROCARDIO · VIDEO",
    channel: "YouTube kanaliga o‘tish",
  },
  contact: {
    tag: "BIZ BILAN BOG‘LANING",
    title: "Salomatligingizga bugundan e’tibor bering",
    text: "Kerakli shifokorni tanlang. Sizni tegishli mutaxassisning Telegram sahifasiga yo‘naltiramiz.",
    points: ["Mutaxassisni tanlash", "Telegram orqali bog‘lanish", "Qulay va sodda"],
    name: "Ism va familiyangiz",
    namePh: "Ismingizni kiriting",
    phone: "Telefon raqamingiz",
    doctor: "Shifokorni tanlang",
    submit: "Telegram orqali bog‘lanish",
    note: "Tugma tanlangan shifokorning Telegram sahifasini ochadi. Ism va telefon raqami avtomatik yuborilmaydi.",
    chooseFirst: "Iltimos, avval shifokorni tanlang.",
  },
  footer: {
    tagline: "Nevrologiya va kardiologiya haqida shifokorlardan ishonchli ma’lumotlar.",
    sections: "Bo‘limlar",
    doctors: "Shifokorlar",
    follow: "Kuzatib boring",
    disclaimer:
      "Saytdagi ma’lumotlar tanishish uchun berilgan va shifokor ko‘rigi o‘rnini bosmaydi. Davolanish bo‘yicha qaror qabul qilishdan oldin mutaxassis bilan maslahatlashing.",
    rights: "Barcha huquqlar himoyalangan.",
  },
  modal: {
    close: "Yopish",
    experience: "Tajriba",
    education: "Ta’lim",
    schedule: "Qabul vaqti",
    address: "Manzil",
    empty: "Shifokor haqida batafsil ma’lumot tez orada qo‘shiladi.",
  },
};

export type Dict = typeof uz;

const ru: Dict = {
  nav: {
    directions: "Направления",
    doctors: "Врачи",
    videos: "Видео",
    contact: "Запись",
    cta: "Записаться",
    menuOpen: "Открыть меню",
    menuClose: "Закрыть меню",
    theme: "Сменить тему",
    lang: "Выбор языка",
  },
  hero: {
    eyebrow: "МОЗГ · СЕРДЦЕ · ЗДОРОВЬЕ",
    title1: "Здоровая жизнь начинается",
    title2: " с надёжных знаний",
    title3: "",
    text: "Простая и достоверная информация о неврологии, кардиологии и здоровье в целом — от практикующих врачей.",
    cta: "Записаться",
    videos: "Видео",
    stat1: "Медицинских видео",
    stat2: "Специалисты",
    stat3: "Полезные знания",
    chipNeuro: "Неврология",
    chipCardio: "Кардиология",
  },
  trust: [
    { title: "От врачей", text: "Каждую тему объясняет специалист" },
    { title: "Научный подход", text: "Опираемся на современные рекомендации" },
    { title: "Бесплатно", text: "Видео доступны всем" },
    { title: "Быстрая связь", text: "Напишите врачу в Telegram" },
  ],
  directions: {
    tag: "НАПРАВЛЕНИЯ",
    title: "Важные знания о здоровье",
    text: "Как устроен организм, как сформировать здоровые привычки и предупредить болезни.",
    more: "Подробнее",
    items: [
      { title: "Неврология", text: "Здоровье мозга и нервной системы" },
      { title: "Кардиология", text: "О сердце и артериальном давлении" },
      { title: "Профилактика", text: "Как предупредить заболевания" },
      { title: "Сон и стресс", text: "Здоровый сон и психическое здоровье" },
    ],
  },
  doctors: {
    tag: "СПЕЦИАЛИСТЫ",
    title: "Наши врачи",
    text: "Свяжитесь со специалистом и получите нужную вам информацию.",
    call: "Позвонить",
    more: "Подробнее",
  },
  videos: {
    tag: "ВИДЕОТЕКА",
    title: "Полезные медицинские видео",
    text: "Смотрите видео о здоровье с канала NeyroCardio прямо на этой странице.",
    label: "NEYROCARDIO · ВИДЕО",
    channel: "Перейти на YouTube-канал",
  },
  contact: {
    tag: "СВЯЖИТЕСЬ С НАМИ",
    title: "Позаботьтесь о своём здоровье уже сегодня",
    text: "Выберите врача — мы перенаправим вас в Telegram нужного специалиста.",
    points: ["Выбор специалиста", "Связь через Telegram", "Удобно и просто"],
    name: "Имя и фамилия",
    namePh: "Введите ваше имя",
    phone: "Номер телефона",
    doctor: "Выберите врача",
    submit: "Написать в Telegram",
    note: "Кнопка откроет Telegram выбранного врача. Имя и номер телефона автоматически не отправляются.",
    chooseFirst: "Пожалуйста, сначала выберите врача.",
  },
  footer: {
    tagline: "Достоверная информация о неврологии и кардиологии от практикующих врачей.",
    sections: "Разделы",
    doctors: "Врачи",
    follow: "Подписывайтесь",
    disclaimer:
      "Информация на сайте носит ознакомительный характер и не заменяет консультацию врача. Перед принятием решений о лечении проконсультируйтесь со специалистом.",
    rights: "Все права защищены.",
  },
  modal: {
    close: "Закрыть",
    experience: "Опыт",
    education: "Образование",
    schedule: "Часы приёма",
    address: "Адрес",
    empty: "Подробная информация о враче скоро появится.",
  },
};

export const DICT: Record<Lang, Dict> = { uz, ru };

export const isLang = (v: unknown): v is Lang => v === "uz" || v === "ru";

/** Shifokor matnini tanlangan tilda qaytaradi (ruschasi bo'sh bo'lsa — o'zbekchasi). */
export function doctorText(d: Doctor, key: keyof DoctorRu, lang: Lang): string {
  const own = (d[key] as string | undefined) ?? "";
  if (lang === "ru") return d.ru?.[key]?.trim() || own;
  return own;
}

export function videoTitle(v: Video, lang: Lang): string {
  return lang === "ru" && v.titleRu?.trim() ? v.titleRu : v.title;
}
