// NeyroCardio Telegram boti (server). Webhook har bir yangilanishni shu yerga beradi.
//
// Imkoniyatlar:
//  • /start — animatsion salomlashuv (❤️ effekt), asosiy menyu va pastki doimiy menyu
//  • Shifokorlar: rasm, ma'lumot, "Shifokorga yozish", "Qabulga yozilish"
//  • Shifokorga yozish: bemor bot ichida yozadi (matn, rasm, ovoz, video, fayl) → xabar shifokorning
//    Telegram'iga boradi; shifokor "Reply" qilib yoki "Javob yozish" tugmasi bilan javob beradi → bemorga boradi
//  • Qabulga yozilish: shifokor → ism → telefon (bir tugma) → tasdiq → so'rov shifokorga
//  • Videolar, aloqa, til (UZ/RU)
//  • Shifokor paneli: oxirgi suhbatlar, javob yozish, suhbatni yopish, bloklash
//  • Shifokorni bog'lash: kabinetdagi tugma → t.me/bot?start=link_KOD
import { randomBytes } from "crypto";
import { tooManyAttempts } from "./doctor-auth";
import { doctorText } from "./i18n";
import { kvDelete, kvGet, kvSet, readData } from "./store";
import { doctorIdByTelegram, getDoctorLinks, html, linkDoctor, tgApi } from "./telegram";
import type { Doctor, Lang } from "./types";

/* ============================ Turlar ============================ */

type TgFrom = { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string };
type TgMessage = {
  message_id: number;
  chat: { id: number; type: string };
  from?: TgFrom;
  text?: string;
  caption?: string;
  photo?: unknown[];
  video?: unknown;
  voice?: unknown;
  audio?: unknown;
  document?: unknown;
  sticker?: unknown;
  video_note?: unknown;
  animation?: unknown;
  contact?: { phone_number: string; user_id?: number; first_name?: string };
  reply_to_message?: { message_id: number };
};
export type TgUpdate = {
  message?: TgMessage;
  callback_query?: { id: string; from: TgFrom; data?: string; message?: { chat: { id: number }; message_id: number } };
};

type UserState = {
  lang?: Lang;
  mode?: "idle" | "chat" | "appt";
  doctorId?: string; // suhbat yoki qabul uchun tanlangan shifokor
  step?: "name" | "phone" | "confirm";
  apptName?: string;
  apptPhone?: string;
  replyTo?: number; // shifokor uchun: hozir kimga javob yozyapti
  kb?: boolean | number; // pastki menyu qaysi versiyasi yuborilgan
  blockedBy?: string[]; // bu bemorni bloklagan shifokorlar
  name?: string;
  username?: string;
};

type Conv = { p: number; name: string; ts: number; last: string };

/* ============================ Matnlar ============================ */

const T = {
  uz: {
    hello: (n: string) =>
      `Assalomu alaykum${n ? `, <b>${n}</b>` : ""}! 👋\n\n<b>NeyroCardio</b> — nevrolog va kardiolog shifokorlarning rasmiy boti.\n\n✍️ Shifokorga <b>shu yerning o‘zida</b> yozing\n📅 Qabulga yoziling\n🎥 Foydali videolarni ko‘ring\n\nQuyidan tanlang 👇`,
    kbHint: "Pastdagi menyu doim shu yerda turadi 👇",
    btnDoctors: "👨‍⚕️ Shifokorlar",
    btnWrite: "✍️ Shifokorga yozish",
    btnBook: "📅 Qabulga yozilish",
    btnVideos: "🎥 Videolar",
    btnSite: "🌐 Sayt",
    btnContacts: "ℹ️ Aloqa",
    btnLocation: "📍 Manzil",
    locTitle: "NeyroCardio — qabul manzili",
    locAddress: "Toshkent sh. · xaritada ko‘rish uchun bosing",
    locText: "📍 <b>Qabul manzili</b>\n\nYo‘nalish olish uchun quyidagi xaritalardan birini tanlang 👇",
    btnRoute: "🧭 Yo‘l ko‘rsatish",
    btnLang: "🌍 Русский",
    btnBack: "« Orqaga",
    btnHome: "🏠 Menyu",
    btnAll: "📺 Barcha videolar",
    btnChannel: "▶️ YouTube kanal",
    chooseDoctor: "👨‍⚕️ <b>Shifokorni tanlang:</b>",
    chooseForChat: "✍️ <b>Kimga yozamiz?</b>\n\nShifokorni tanlang — xabaringiz to‘g‘ridan-to‘g‘ri unga boradi.",
    chooseForBook: "📅 <b>Qabulga yozilish</b>\n\nQaysi shifokorga yozilasiz?",
    write: "✍️ Shifokorga yozish",
    bookThis: "📅 Qabulga yozilish",
    tgDirect: "✈️ Shaxsiy Telegram’i",
    phoneL: "📞 Telefon",
    exp: "Tajriba",
    sched: "Qabul vaqti",
    addr: "Manzil",
    chatStart: (d: string) =>
      `✍️ <b>${d}</b> bilan suhbat ochildi.\n\nSavolingizni yozing — matn, 📷 rasm (masalan, tahlil natijasi), 🎙 ovozli xabar yoki 📎 fayl yuborishingiz mumkin. Javob shu chatga keladi.\n\n<i>⚠️ Bot orqali maslahat shifokor ko‘rigi o‘rnini bosmaydi. Shoshilinch holatda 103 ga qo‘ng‘iroq qiling.</i>`,
    btnEndChat: "🔚 Suhbatni tugatish",
    chatEnded: "Suhbat yakunlandi. Yana savol bo‘lsa — “✍️ Shifokorga yozish” ni bosing.",
    notLinked: (d: string) =>
      `Kechirasiz, <b>${d}</b> hali botga ulanmagan. Hozircha uning shaxsiy Telegram’iga yozishingiz mumkin:`,
    sentFirst: "✅ Xabaringiz shifokorga yetkazildi. Javob shu yerga keladi.",
    blocked: "Bu shifokorga xabar yuborish cheklangan.",
    slow: "Juda ko‘p xabar. Birozdan keyin yozing.",
    idleHint: "Savolingizni qaysi shifokorga yuboramiz?",
    fromDoctor: (d: string, role: string) => `👨‍⚕️ <b>${d}</b> · ${role}`,
    btnReplyDoctor: "✍️ Javob yozish",
    apptName: (d: string) => `📅 <b>${d}</b> qabuliga yozilish.\n\n1/2 · Ism va familiyangizni yozing:`,
    apptPhone: "2/2 · Telefon raqamingizni yuboring — pastdagi tugmani bosing yoki raqamni yozing (+998…):",
    btnShareContact: "📱 Raqamni yuborish",
    btnCancel: "❌ Bekor qilish",
    apptBadPhone: "Raqam noto‘g‘ri. Masalan: +998901234567",
    apptConfirm: (d: string, n: string, p: string) =>
      `Tekshiring:\n\n👨‍⚕️ ${d}\n👤 ${n}\n📞 ${p}\n\nYuboraymi?`,
    btnSend: "✅ Yuborish",
    apptSent: "✅ <b>So‘rovingiz yuborildi!</b>\n\nShifokor tez orada siz bilan bog‘lanadi.",
    apptNoDoctor: (d: string, phone: string) =>
      `So‘rovni avtomatik yuborib bo‘lmadi: <b>${d}</b> hali botga ulanmagan.\nIltimos, to‘g‘ridan-to‘g‘ri bog‘laning: ${phone}`,
    cancelled: "Bekor qilindi.",
    videosTitle: "🎥 <b>Foydali videolar</b>\n\nTanlang — YouTube’da ochiladi:",
    contacts: (lines: string) =>
      `ℹ️ <b>NeyroCardio</b>\n\n${lines}\n\n🌐 neyrocardio.uz\n▶️ YouTube: @Neurocardiouz\n\n<i>Shoshilinch holatda — 103</i>`,
    langSet: "Til: O‘zbekcha ✅",
    // Shifokor tomoni
    docHello: (d: string) =>
      `👨‍⚕️ Xush kelibsiz, <b>${d}</b>!\n\nBemorlar xabarlari shu yerga keladi. Javob berish uchun bemor xabariga <b>Reply</b> qiling yoki “✍️ Javob yozish” tugmasini bosing.`,
    btnConvs: "📋 Oxirgi suhbatlar",
    btnCabinet: "👤 Kabinet",
    noConvs: "Hozircha suhbatlar yo‘q.",
    convsTitle: "📋 <b>Oxirgi suhbatlar</b> — javob yozish uchun tanlang:",
    newMsg: (n: string, u: string) => `💬 <b>${n}</b>${u ? ` (@${u})` : ""}`,
    btnAnswer: "✍️ Javob yozish",
    btnClose: "✅ Yopish",
    btnBlock: "🚫 Bloklash",
    replyMode: (n: string) => `✍️ <b>${n}</b> ga javob yozing (keyingi xabaringiz unga boradi):`,
    replied: "✅ Bemorga yuborildi.",
    replyNoTarget: "Kimga javob berishni tanlang: bemor xabariga Reply qiling yoki “📋 Oxirgi suhbatlar”.",
    closed: "✅ Suhbat yopildi.",
    blockedOk: "🚫 Bemor bloklandi.",
    linked: (d: string) => `✅ Telegram bog‘landi! Siz endi <b>${d}</b> sifatida bemorlar xabarlarini shu yerda olasiz.`,
    linkBad: "Havola eskirgan yoki noto‘g‘ri. Kabinetdan qayta urinib ko‘ring.",
    newAppt: "🩺 <b>Yangi qabul so‘rovi</b> (bot)",
    patientClosed: "Shifokor suhbatni yakunladi. Rahmat! Yana savol bo‘lsa — “✍️ Shifokorga yozish”.",
  },
  ru: {
    hello: (n: string) =>
      `Здравствуйте${n ? `, <b>${n}</b>` : ""}! 👋\n\n<b>NeyroCardio</b> — официальный бот врачей-невролога и кардиолога.\n\n✍️ Пишите врачу <b>прямо здесь</b>\n📅 Записывайтесь на приём\n🎥 Смотрите полезные видео\n\nВыберите ниже 👇`,
    kbHint: "Меню внизу всегда под рукой 👇",
    btnDoctors: "👨‍⚕️ Врачи",
    btnWrite: "✍️ Написать врачу",
    btnBook: "📅 Записаться",
    btnVideos: "🎥 Видео",
    btnSite: "🌐 Сайт",
    btnContacts: "ℹ️ Контакты",
    btnLocation: "📍 Адрес",
    locTitle: "NeyroCardio — адрес приёма",
    locAddress: "г. Ташкент · нажмите, чтобы открыть карту",
    locText: "📍 <b>Адрес приёма</b>\n\nВыберите карту, чтобы построить маршрут 👇",
    btnRoute: "🧭 Построить маршрут",
    btnLang: "🌍 O‘zbekcha",
    btnBack: "« Назад",
    btnHome: "🏠 Меню",
    btnAll: "📺 Все видео",
    btnChannel: "▶️ YouTube-канал",
    chooseDoctor: "👨‍⚕️ <b>Выберите врача:</b>",
    chooseForChat: "✍️ <b>Кому написать?</b>\n\nВыберите врача — сообщение придёт ему напрямую.",
    chooseForBook: "📅 <b>Запись на приём</b>\n\nК какому врачу записаться?",
    write: "✍️ Написать врачу",
    bookThis: "📅 Записаться",
    tgDirect: "✈️ Личный Telegram",
    phoneL: "📞 Телефон",
    exp: "Опыт",
    sched: "Часы приёма",
    addr: "Адрес",
    chatStart: (d: string) =>
      `✍️ Открыт чат с врачом <b>${d}</b>.\n\nНапишите вопрос — можно отправить текст, 📷 фото (например, анализы), 🎙 голосовое или 📎 файл. Ответ придёт в этот чат.\n\n<i>⚠️ Консультация в боте не заменяет осмотр врача. В экстренном случае звоните 103.</i>`,
    btnEndChat: "🔚 Завершить чат",
    chatEnded: "Чат завершён. Если появятся вопросы — нажмите «✍️ Написать врачу».",
    notLinked: (d: string) => `К сожалению, <b>${d}</b> ещё не подключён к боту. Пока можно написать ему в личный Telegram:`,
    sentFirst: "✅ Сообщение доставлено врачу. Ответ придёт сюда.",
    blocked: "Отправка сообщений этому врачу ограничена.",
    slow: "Слишком много сообщений. Подождите немного.",
    idleHint: "Какому врачу отправить ваш вопрос?",
    fromDoctor: (d: string, role: string) => `👨‍⚕️ <b>${d}</b> · ${role}`,
    btnReplyDoctor: "✍️ Ответить",
    apptName: (d: string) => `📅 Запись к врачу <b>${d}</b>.\n\n1/2 · Напишите ваше имя и фамилию:`,
    apptPhone: "2/2 · Отправьте номер телефона — нажмите кнопку ниже или напишите номер (+998…):",
    btnShareContact: "📱 Отправить номер",
    btnCancel: "❌ Отмена",
    apptBadPhone: "Неверный номер. Например: +998901234567",
    apptConfirm: (d: string, n: string, p: string) => `Проверьте:\n\n👨‍⚕️ ${d}\n👤 ${n}\n📞 ${p}\n\nОтправить?`,
    btnSend: "✅ Отправить",
    apptSent: "✅ <b>Заявка отправлена!</b>\n\nВрач скоро свяжется с вами.",
    apptNoDoctor: (d: string, phone: string) =>
      `Не удалось отправить автоматически: <b>${d}</b> ещё не подключён к боту.\nСвяжитесь напрямую: ${phone}`,
    cancelled: "Отменено.",
    videosTitle: "🎥 <b>Полезные видео</b>\n\nВыберите — откроется в YouTube:",
    contacts: (lines: string) =>
      `ℹ️ <b>NeyroCardio</b>\n\n${lines}\n\n🌐 neyrocardio.uz\n▶️ YouTube: @Neurocardiouz\n\n<i>В экстренном случае — 103</i>`,
    langSet: "Язык: Русский ✅",
    docHello: (d: string) =>
      `👨‍⚕️ Добро пожаловать, <b>${d}</b>!\n\nСообщения пациентов приходят сюда. Чтобы ответить — сделайте <b>Reply</b> на сообщение пациента или нажмите «✍️ Ответить».`,
    btnConvs: "📋 Последние чаты",
    btnCabinet: "👤 Кабинет",
    noConvs: "Пока нет чатов.",
    convsTitle: "📋 <b>Последние чаты</b> — выберите, чтобы ответить:",
    newMsg: (n: string, u: string) => `💬 <b>${n}</b>${u ? ` (@${u})` : ""}`,
    btnAnswer: "✍️ Ответить",
    btnClose: "✅ Закрыть",
    btnBlock: "🚫 Заблокировать",
    replyMode: (n: string) => `✍️ Напишите ответ для <b>${n}</b> (следующее сообщение уйдёт ему):`,
    replied: "✅ Отправлено пациенту.",
    replyNoTarget: "Выберите, кому ответить: сделайте Reply на сообщение пациента или откройте «📋 Последние чаты».",
    closed: "✅ Чат закрыт.",
    blockedOk: "🚫 Пациент заблокирован.",
    linked: (d: string) => `✅ Telegram подключён! Теперь вы получаете сообщения пациентов как <b>${d}</b>.`,
    linkBad: "Ссылка устарела или неверна. Попробуйте снова из кабинета.",
    newAppt: "🩺 <b>Новая заявка на приём</b> (бот)",
    patientClosed: "Врач завершил чат. Спасибо! Если появятся вопросы — «✍️ Написать врачу».",
  },
};
type Dict = (typeof T)["uz"];

/* ============================ Yordamchilar ============================ */

const userKey = (id: number) => `tg/u/${id}`;
const mapKey = (chat: number, msg: number) => `tg/m/${chat}-${msg}`;
const convKey = (doctorId: string) => `tg/c/${doctorId}`;
const linkKey = (code: string) => `tg/link/${code}`;

async function getUser(id: number): Promise<UserState> {
  return (await kvGet<UserState>(userKey(id))) ?? {};
}
async function saveUser(id: number, u: UserState) {
  await kvSet(userKey(id), u);
}

const langFrom = (u: UserState, from?: TgFrom): Lang =>
  u.lang ?? ((from?.language_code ?? "").startsWith("ru") ? "ru" : "uz");
const fullName = (f?: TgFrom) =>
  [f?.first_name, f?.last_name].filter(Boolean).join(" ").replace(/[<>&]/g, "").trim().slice(0, 40) || "Bemor";
const icon = (d: Doctor) => (d.accent === "cardio" ? "❤️" : "🧠");
const dName = (d: Doctor, l: Lang) => doctorText(d, "name", l);
const dRole = (d: Doctor, l: Lang) => doctorText(d, "role", l);
const webApp = (site: string, path: string) => ({ url: new URL(path, site).toString() });

// Pastki menyu versiyasi: o'zgarsa, eski foydalanuvchilarga /start da yangisi yuboriladi
const KB_VER = 2;

const send = (chatId: number, text: string, markup?: unknown, extra: Record<string, unknown> = {}) =>
  tgApi<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(markup ? { reply_markup: markup } : {}),
    ...extra,
  });

const react = (chatId: number, messageId: number, emoji = "👌") =>
  tgApi("setMessageReaction", { chat_id: chatId, message_id: messageId, reaction: [{ type: "emoji", emoji }] });

/* ============================ Klaviaturalar ============================ */

function bottomKeyboard(site: string, t: Dict) {
  return {
    keyboard: [
      [{ text: t.btnDoctors }, { text: t.btnWrite }],
      [{ text: t.btnBook }, { text: t.btnVideos }],
      [{ text: t.btnSite, web_app: webApp(site, "/") }, { text: t.btnContacts }],
      [{ text: t.btnLocation }, { text: t.btnLang }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function doctorKeyboard(site: string, t: Dict) {
  return {
    keyboard: [[{ text: t.btnConvs }], [{ text: t.btnCabinet, web_app: webApp(site, "/doctor") }, { text: t.btnSite, web_app: webApp(site, "/") }]],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function mainInline(site: string, t: Dict) {
  return {
    inline_keyboard: [
      [{ text: t.btnWrite, callback_data: "chatpick" }],
      [
        { text: t.btnDoctors, callback_data: "doctors" },
        { text: t.btnBook, callback_data: "bookpick" },
      ],
      [
        { text: t.btnVideos, callback_data: "videos" },
        { text: t.btnSite, web_app: webApp(site, "/") },
      ],
      [{ text: t.btnLocation, callback_data: "loc" }],
    ],
  };
}

function doctorList(doctors: Doctor[], l: Lang, prefix: string, t: Dict) {
  return {
    inline_keyboard: [
      ...doctors.map((d) => [{ text: `${icon(d)} ${dName(d, l)} — ${dRole(d, l)}`, callback_data: `${prefix}:${d.id}` }]),
      [{ text: t.btnBack, callback_data: "home" }],
    ],
  };
}

const patientReplyKb = (t: Dict, doctorId: string) => ({
  inline_keyboard: [[{ text: t.btnReplyDoctor, callback_data: `chat:${doctorId}` }, { text: t.btnEndChat, callback_data: "endchat" }]],
});

const doctorActions = (t: Dict, patient: number) => ({
  inline_keyboard: [
    [{ text: t.btnAnswer, callback_data: `r:${patient}` }],
    [
      { text: t.btnClose, callback_data: `close:${patient}` },
      { text: t.btnBlock, callback_data: `block:${patient}` },
    ],
  ],
});

/* ============================ Salomlashuv animatsiyasi ============================ */

const WELCOME_VERSION = "v1";
const WELCOME_KEY = "tg-welcome-file";
const HEART_EFFECT = "5159385139981059251"; // ❤️ xabar effekti
type SentMessage = { message_id?: number; animation?: { file_id: string } };

async function welcomeMedia(site: string): Promise<string> {
  const saved = await kvGet<{ v: string; id: string }>(WELCOME_KEY);
  return saved?.v === WELCOME_VERSION ? saved.id : new URL(`/bot/welcome.mp4?${WELCOME_VERSION}`, site).toString();
}
async function rememberWelcome(msg: SentMessage | null) {
  const id = msg?.animation?.file_id;
  if (id) await kvSet(WELCOME_KEY, { v: WELCOME_VERSION, id }).catch(() => undefined);
}

async function sendWelcome(chatId: number, site: string, caption: string, markup: unknown) {
  await tgApi("sendChatAction", { chat_id: chatId, action: "typing" });
  const base = { chat_id: chatId, animation: await welcomeMedia(site), caption, parse_mode: "HTML", reply_markup: markup };
  const sent =
    (await tgApi<SentMessage>("sendAnimation", { ...base, message_effect_id: HEART_EFFECT })) ??
    (await tgApi<SentMessage>("sendAnimation", base));
  if (sent) await rememberWelcome(sent);
  else await send(chatId, caption, markup);
}

/** Mavjud xabarni almashtiradi (ilovadagidek); bo'lmasa yangisini yuboradi. */
async function show(
  chatId: number,
  messageId: number | undefined,
  media: { type: "animation" | "photo"; media: string },
  caption: string,
  markup: unknown,
) {
  if (messageId) {
    const edited = await tgApi<SentMessage>("editMessageMedia", {
      chat_id: chatId,
      message_id: messageId,
      media: { ...media, caption, parse_mode: "HTML" },
      reply_markup: markup,
    });
    if (edited) {
      if (media.type === "animation") await rememberWelcome(edited);
      return;
    }
  }
  const sent = await tgApi<SentMessage>(media.type === "photo" ? "sendPhoto" : "sendAnimation", {
    chat_id: chatId,
    [media.type]: media.media,
    caption,
    parse_mode: "HTML",
    reply_markup: markup,
  });
  if (!sent) await send(chatId, caption, markup);
  else if (media.type === "animation") await rememberWelcome(sent);
}

/* ============================ Shifokor kartasi ============================ */

function doctorCaption(d: Doctor, l: Lang, t: Dict) {
  const lines = [`${icon(d)} <b>${html(dName(d, l))}</b>`, `<i>${html(dRole(d, l))}</i>`];
  const bio = doctorText(d, "bio", l) || doctorText(d, "description", l);
  if (bio) lines.push("", html(bio.length > 600 ? `${bio.slice(0, 600)}…` : bio));
  const facts: [string, string][] = [
    [t.exp, doctorText(d, "experience", l)],
    [t.sched, doctorText(d, "schedule", l)],
    [t.addr, doctorText(d, "address", l)],
  ];
  for (const [k, v] of facts) if (v) lines.push(`<b>${k}:</b> ${html(v)}`);
  if (d.phone) lines.push("", `${t.phoneL}: ${html(d.phone)}`);
  return lines.join("\n");
}

function doctorCardKb(d: Doctor, t: Dict) {
  const rows: unknown[][] = [
    [{ text: t.write, callback_data: `chat:${d.id}` }],
    [{ text: t.bookThis, callback_data: `book:${d.id}` }],
  ];
  if (d.telegram) rows.push([{ text: t.tgDirect, url: d.telegram }]);
  rows.push([{ text: t.btnBack, callback_data: "doctors" }]);
  return { inline_keyboard: rows };
}

/* ============================ Relay: bemor ↔ shifokor ============================ */

const hasMedia = (m: TgMessage) => Boolean(m.photo || m.video || m.voice || m.audio || m.document || m.animation);
const noCaption = (m: TgMessage) => Boolean(m.sticker || m.video_note);

/** Xabarni (har qanday turdagi) sarlavha bilan boshqa chatga nusxalaydi. Yuborilgan xabar ID larini qaytaradi. */
async function relay(to: number, m: TgMessage, header: string, markup: unknown): Promise<number[]> {
  const ids: number[] = [];
  if (m.text) {
    const r = await send(to, `${header}\n\n${html(m.text)}`, markup);
    if (r?.message_id) ids.push(r.message_id);
  } else if (hasMedia(m)) {
    const caption = m.caption ? `${header}\n\n${html(m.caption)}` : header;
    const r = await tgApi<{ message_id: number }>("copyMessage", {
      chat_id: to,
      from_chat_id: m.chat.id,
      message_id: m.message_id,
      caption,
      parse_mode: "HTML",
      reply_markup: markup,
    });
    if (r?.message_id) ids.push(r.message_id);
  } else if (noCaption(m)) {
    const h = await send(to, header, markup);
    if (h?.message_id) ids.push(h.message_id);
    const r = await tgApi<{ message_id: number }>("copyMessage", { chat_id: to, from_chat_id: m.chat.id, message_id: m.message_id });
    if (r?.message_id) ids.push(r.message_id);
  }
  return ids;
}

const previewOf = (m: TgMessage) =>
  (m.text || m.caption || (m.photo ? "📷" : m.voice ? "🎙" : m.video ? "🎬" : m.document ? "📎" : m.sticker ? "🙂" : "…")).slice(0, 60);

async function rememberConv(doctorId: string, p: number, name: string, last: string) {
  const list = ((await kvGet<Conv[]>(convKey(doctorId))) ?? []).filter((c) => c.p !== p);
  list.unshift({ p, name, ts: Date.now(), last });
  await kvSet(convKey(doctorId), list.slice(0, 15));
}

async function patientToDoctor(m: TgMessage, u: UserState, doctors: Doctor[], t: Dict, l: Lang) {
  const from = m.from!;
  const d = doctors.find((x) => x.id === u.doctorId);
  if (!d) return send(m.chat.id, t.idleHint, doctorList(doctors, l, "chat", t));
  if (u.blockedBy?.includes(d.id)) return send(m.chat.id, t.blocked);
  if (tooManyAttempts(`bot:${from.id}`, 25, 10 * 60 * 1000)) return send(m.chat.id, t.slow);

  const docChat = (await getDoctorLinks())[d.id];
  if (!docChat) {
    return send(m.chat.id, t.notLinked(html(dName(d, l))), d.telegram ? { inline_keyboard: [[{ text: t.tgDirect, url: d.telegram }]] } : undefined);
  }

  const name = fullName(from);
  const dt = T[(await getUser(docChat)).lang ?? "uz"];
  const ids = await relay(docChat, m, dt.newMsg(name, from.username ?? ""), doctorActions(dt, from.id));
  if (!ids.length) return;
  await Promise.all(ids.map((id) => kvSet(mapKey(docChat, id), { p: from.id, d: d.id })));
  await rememberConv(d.id, from.id, name, previewOf(m));

  await react(m.chat.id, m.message_id);
  if (!u.name) {
    // Birinchi xabarda bir marta tasdiq
    await send(m.chat.id, t.sentFirst);
    await saveUser(from.id, { ...u, name, username: from.username });
  }
}

async function doctorToPatient(m: TgMessage, doctorId: string, patient: number, doctors: Doctor[], t: Dict) {
  const d = doctors.find((x) => x.id === doctorId);
  if (!d) return;
  const pu = await getUser(patient);
  const pl: Lang = pu.lang ?? "uz";
  const pt = T[pl];
  const ids = await relay(patient, m, pt.fromDoctor(html(dName(d, pl)), html(dRole(d, pl))), patientReplyKb(pt, d.id));
  if (ids.length) {
    // Bemor javobga javob qaytarsa, shu shifokorga ketsin
    await saveUser(patient, { ...pu, mode: "chat", doctorId: d.id, step: undefined });
    await react(m.chat.id, m.message_id, "👍");
  } else {
    await send(m.chat.id, "⚠️ Yuborilmadi (bemor botni to‘xtatgan bo‘lishi mumkin).");
  }
  void t;
}

/* ============================ Qabulga yozilish ============================ */

async function apptAsk(chatId: number, u: UserState, from: TgFrom, d: Doctor, t: Dict, l: Lang) {
  await saveUser(from.id, { ...u, mode: "appt", doctorId: d.id, step: "name", apptName: undefined, apptPhone: undefined });
  const suggested = fullName(from);
  await send(chatId, t.apptName(html(dName(d, l))), {
    keyboard: [[{ text: suggested }], [{ text: t.btnCancel }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  });
}

async function apptStep(m: TgMessage, u: UserState, doctors: Doctor[], t: Dict, l: Lang, site: string) {
  const from = m.from!;
  const d = doctors.find((x) => x.id === u.doctorId);
  if (!d) return;
  if (u.step === "name") {
    const name = (m.text ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (name.length < 2) return send(m.chat.id, t.apptName(html(dName(d, l))));
    await saveUser(from.id, { ...u, step: "phone", apptName: name });
    return send(m.chat.id, t.apptPhone, {
      keyboard: [[{ text: t.btnShareContact, request_contact: true }], [{ text: t.btnCancel }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    });
  }
  if (u.step === "phone") {
    const raw = m.contact?.phone_number ?? m.text ?? "";
    let phone = raw.replace(/[^\d+]/g, "");
    if (phone && !phone.startsWith("+")) phone = `+${phone}`;
    if (!/^\+\d{9,15}$/.test(phone)) return send(m.chat.id, t.apptBadPhone);
    await saveUser(from.id, { ...u, step: "confirm", apptPhone: phone });
    await send(m.chat.id, "👌", bottomKeyboard(site, t));
    return send(m.chat.id, t.apptConfirm(html(dName(d, l)), html(u.apptName ?? ""), phone), {
      inline_keyboard: [[{ text: t.btnSend, callback_data: "appt:ok" }, { text: t.btnCancel, callback_data: "appt:no" }]],
    });
  }
}

async function apptSubmit(chatId: number, from: TgFrom, u: UserState, doctors: Doctor[], t: Dict, l: Lang) {
  const d = doctors.find((x) => x.id === u.doctorId);
  await saveUser(from.id, { ...u, mode: "idle", step: undefined });
  if (!d || !u.apptName || !u.apptPhone) return send(chatId, t.cancelled);
  const docChat = (await getDoctorLinks())[d.id];
  if (!docChat) return send(chatId, t.apptNoDoctor(html(dName(d, l)), html(d.phone)));
  const dt = T[(await getUser(docChat)).lang ?? "uz"];
  const text = [
    dt.newAppt,
    "",
    `👤 ${html(u.apptName)}`,
    `📞 ${html(u.apptPhone)}`,
    `✈️ ${from.username ? `@${html(from.username)}` : html(fullName(from))}`,
  ].join("\n");
  const r = await send(docChat, text, doctorActions(dt, from.id));
  if (r?.message_id) await kvSet(mapKey(docChat, r.message_id), { p: from.id, d: d.id });
  await rememberConv(d.id, from.id, u.apptName, "📅");
  return send(chatId, t.apptSent);
}

/* ============================ Bo'limlar ============================ */

async function showVideos(chatId: number, l: Lang, t: Dict, site: string) {
  const { videos } = await readData();
  const rows: unknown[][] = videos.slice(0, 8).map((v) => [
    { text: `▶️ ${(l === "ru" && v.titleRu ? v.titleRu : v.title).slice(0, 60)}`, url: `https://youtu.be/${v.id}${v.start ? `?t=${v.start}` : ""}` },
  ]);
  rows.push([{ text: t.btnAll, web_app: webApp(site, "/#videolar") }]);
  rows.push([{ text: t.btnChannel, url: "https://www.youtube.com/@Neurocardiouz" }]);
  return send(chatId, t.videosTitle, { inline_keyboard: rows });
}

/* ============================ Manzil ============================ */
// Qabul joyi: 41°21'05.6"N 69°12'46.6"E
export const CLINIC = { lat: 41.351556, lng: 69.212944 };

async function showLocation(chatId: number, t: Dict) {
  const { lat, lng } = CLINIC;
  await tgApi("sendVenue", {
    chat_id: chatId,
    latitude: lat,
    longitude: lng,
    title: t.locTitle,
    address: t.locAddress,
  });
  return send(chatId, t.locText, {
    inline_keyboard: [
      [
        { text: "🗺 Google Maps", url: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` },
        { text: "🗺 Yandex", url: `https://yandex.uz/maps/?pt=${lng},${lat}&z=17&l=map` },
      ],
      [{ text: t.btnRoute, url: `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto` }],
    ],
  });
}

async function showContacts(chatId: number, l: Lang, t: Dict) {
  const { doctors } = await readData();
  const lines = doctors
    .map((d) => `${icon(d)} <b>${html(dName(d, l))}</b> — ${html(dRole(d, l))}\n📞 ${html(d.phone)}`)
    .join("\n\n");
  return send(chatId, t.contacts(lines), {
    inline_keyboard: [
      ...doctors.map((d) => [{ text: `✍️ ${dName(d, l)}`, callback_data: `chat:${d.id}` }]),
      [{ text: t.btnLocation, callback_data: "loc" }],
    ],
  });
}

async function startChat(chatId: number, from: TgFrom, u: UserState, d: Doctor, t: Dict, l: Lang) {
  if (u.blockedBy?.includes(d.id)) return send(chatId, t.blocked);
  await saveUser(from.id, { ...u, mode: "chat", doctorId: d.id, step: undefined });
  const linked = Boolean((await getDoctorLinks())[d.id]);
  if (!linked) {
    return send(chatId, t.notLinked(html(dName(d, l))), d.telegram ? { inline_keyboard: [[{ text: t.tgDirect, url: d.telegram }]] } : undefined);
  }
  return send(chatId, t.chatStart(html(dName(d, l))), { inline_keyboard: [[{ text: t.btnEndChat, callback_data: "endchat" }]] });
}

/* ============================ Shifokorni bog'lash kodi ============================ */

export async function createLinkCode(doctorId: string): Promise<string> {
  const code = randomBytes(9).toString("hex");
  await kvSet(linkKey(code), { doctorId, exp: Date.now() + 15 * 60 * 1000 });
  return code;
}

/* ============================ Asosiy ishlov ============================ */

export async function handleUpdate(update: TgUpdate, site: string) {
  if (update.callback_query) return onCallback(update.callback_query, site);
  const m = update.message;
  if (!m || m.chat.type !== "private" || !m.from) return;

  const from = m.from;
  const u = await getUser(from.id);
  const l = langFrom(u, from);
  const t = T[l];
  const { doctors } = await readData();
  const text = (m.text ?? "").trim();

  // /start [payload]
  if (text.startsWith("/start")) {
    const payload = text.split(/\s+/)[1] ?? "";
    if (payload.startsWith("link_")) {
      const rec = await kvGet<{ doctorId: string; exp: number }>(linkKey(payload.slice(5)));
      const d = rec && rec.exp > Date.now() ? doctors.find((x) => x.id === rec.doctorId) : undefined;
      if (!d) return send(m.chat.id, t.linkBad);
      await kvDelete(linkKey(payload.slice(5)));
      await linkDoctor(d.id, from.id);
      await saveUser(from.id, { ...u, mode: "idle", kb: true });
      return send(m.chat.id, t.linked(html(dName(d, l))), doctorKeyboard(site, t));
    }

    const docId = await doctorIdByTelegram(from.id);
    if (docId) {
      const d = doctors.find((x) => x.id === docId);
      await saveUser(from.id, { ...u, mode: "idle", replyTo: undefined, kb: true });
      return send(m.chat.id, t.docHello(html(d ? dName(d, l) : "")), doctorKeyboard(site, t));
    }

    const fresh: UserState = { ...u, lang: l, mode: "idle", step: undefined };
    await saveUser(from.id, fresh);
    await sendWelcome(m.chat.id, site, t.hello(html(from.first_name ?? "")), mainInline(site, t));
    if (u.kb !== KB_VER) {
      await send(m.chat.id, t.kbHint, bottomKeyboard(site, t));
      await saveUser(from.id, { ...fresh, kb: KB_VER });
    }
    const d = doctors.find((x) => `doc_${x.id}` === payload);
    if (d) return show(m.chat.id, undefined, { type: "photo", media: new URL(d.image || "/icon.png", site).toString() }, doctorCaption(d, l, t), doctorCardKb(d, t));
    if (payload === "book") return send(m.chat.id, t.chooseForBook, doctorList(doctors, l, "book", t));
    if (payload === "ask") return send(m.chat.id, t.chooseForChat, doctorList(doctors, l, "chat", t));
    return;
  }

  /* ---------- Shifokor tomoni ---------- */
  const docId = await doctorIdByTelegram(from.id);
  if (docId) {
    if (text === T.uz.btnConvs || text === T.ru.btnConvs || text === "/chats") return showConvs(m.chat.id, docId, t);
    let target: number | undefined;
    if (m.reply_to_message) {
      const hit = await kvGet<{ p: number; d: string }>(mapKey(m.chat.id, m.reply_to_message.message_id));
      target = hit?.p;
    }
    target ??= u.replyTo;
    if (!target) return send(m.chat.id, t.replyNoTarget, doctorKeyboard(site, t));
    await doctorToPatient(m, docId, target, doctors, t);
    return;
  }

  /* ---------- Bemor tomoni ---------- */
  // Pastki menyu tugmalari (ikkala tilda)
  const is = (k: keyof Dict) => text === T.uz[k] || text === T.ru[k];

  if (is("btnCancel")) {
    await saveUser(from.id, { ...u, mode: "idle", step: undefined });
    return send(m.chat.id, t.cancelled, bottomKeyboard(site, t));
  }
  if (u.mode === "appt" && u.step && u.step !== "confirm") return apptStep(m, u, doctors, t, l, site);

  if (is("btnLang") || text === "/lang") {
    const nl: Lang = l === "uz" ? "ru" : "uz";
    await saveUser(from.id, { ...u, lang: nl });
    return send(m.chat.id, T[nl].langSet, bottomKeyboard(site, T[nl]));
  }
  if (is("btnDoctors") || text === "/doctors") return send(m.chat.id, t.chooseDoctor, doctorList(doctors, l, "doc", t));
  if (is("btnWrite") || text === "/ask") return send(m.chat.id, t.chooseForChat, doctorList(doctors, l, "chat", t));
  if (is("btnBook") || text === "/book") return send(m.chat.id, t.chooseForBook, doctorList(doctors, l, "book", t));
  if (is("btnVideos") || text === "/videos") return showVideos(m.chat.id, l, t, site);
  if (is("btnContacts") || text === "/contacts") return showContacts(m.chat.id, l, t);
  if (is("btnLocation") || text === "/location") return showLocation(m.chat.id, t);
  if (text === "/stop") {
    await saveUser(from.id, { ...u, mode: "idle" });
    return send(m.chat.id, t.chatEnded, bottomKeyboard(site, t));
  }
  if (text === "/help" || text === "/menu") {
    return sendWelcome(m.chat.id, site, t.hello(html(from.first_name ?? "")), mainInline(site, t));
  }

  // Suhbat rejimi — xabar shifokorga boradi
  if (u.mode === "chat" && u.doctorId) return patientToDoctor(m, u, doctors, t, l);

  // Oddiy matn yoki rasm: avval shifokorni tanlash taklif qilinadi
  return send(m.chat.id, t.idleHint, doctorList(doctors, l, "chat", t));
}

async function showConvs(chatId: number, doctorId: string, t: Dict) {
  const list = (await kvGet<Conv[]>(convKey(doctorId))) ?? [];
  if (!list.length) return send(chatId, t.noConvs);
  return send(chatId, t.convsTitle, {
    inline_keyboard: list.slice(0, 10).map((c) => [{ text: `💬 ${c.name} — ${c.last}`.slice(0, 60), callback_data: `r:${c.p}` }]),
  });
}

async function onCallback(cb: NonNullable<TgUpdate["callback_query"]>, site: string) {
  const from = cb.from;
  const chatId = cb.message?.chat.id ?? from.id;
  const messageId = cb.message?.message_id;
  const data = cb.data ?? "";
  const u = await getUser(from.id);
  const l = langFrom(u, from);
  const t = T[l];
  const { doctors } = await readData();
  await tgApi("answerCallbackQuery", { callback_query_id: cb.id });

  const anim = async () => ({ type: "animation" as const, media: await welcomeMedia(site) });
  const [cmd, arg = ""] = data.split(":");
  const d = doctors.find((x) => x.id === arg);

  switch (cmd) {
    case "home":
      return show(chatId, messageId, await anim(), t.hello(html(from.first_name ?? "")), mainInline(site, t));
    case "doctors":
      return show(chatId, messageId, await anim(), t.chooseDoctor, doctorList(doctors, l, "doc", t));
    case "chatpick":
      return show(chatId, messageId, await anim(), t.chooseForChat, doctorList(doctors, l, "chat", t));
    case "bookpick":
      return show(chatId, messageId, await anim(), t.chooseForBook, doctorList(doctors, l, "book", t));
    case "videos":
      return showVideos(chatId, l, t, site);
    case "loc":
      return showLocation(chatId, t);
    case "doc":
      if (!d) return;
      return show(
        chatId,
        messageId,
        d.image ? { type: "photo", media: new URL(d.image, site).toString() } : await anim(),
        doctorCaption(d, l, t),
        doctorCardKb(d, t),
      );
    case "chat":
      if (!d) return;
      return startChat(chatId, from, u, d, t, l);
    case "endchat":
      await saveUser(from.id, { ...u, mode: "idle" });
      return send(chatId, t.chatEnded, bottomKeyboard(site, t));
    case "book":
      if (!d) return;
      return apptAsk(chatId, u, from, d, t, l);
    case "appt":
      if (arg === "ok" && u.mode === "appt" && u.step === "confirm") return apptSubmit(chatId, from, u, doctors, t, l);
      await saveUser(from.id, { ...u, mode: "idle", step: undefined });
      return send(chatId, t.cancelled);
  }

  /* ---------- Shifokor tugmalari ---------- */
  const docId = await doctorIdByTelegram(from.id);
  if (!docId) return;
  const patient = Number(arg);
  if (!Number.isFinite(patient) || patient <= 0) return;
  const pu = await getUser(patient);
  const pname = pu.name || "Bemor";

  if (cmd === "r") {
    await saveUser(from.id, { ...u, replyTo: patient });
    return send(chatId, t.replyMode(html(pname)), { force_reply: true, input_field_placeholder: pname });
  }
  if (cmd === "close") {
    await saveUser(patient, { ...pu, mode: "idle" });
    if (u.replyTo === patient) await saveUser(from.id, { ...u, replyTo: undefined });
    await send(patient, T[pu.lang ?? "uz"].patientClosed);
    return send(chatId, t.closed);
  }
  if (cmd === "block") {
    const blockedBy = Array.from(new Set([...(pu.blockedBy ?? []), docId]));
    await saveUser(patient, { ...pu, mode: "idle", blockedBy });
    return send(chatId, t.blockedOk);
  }
}
