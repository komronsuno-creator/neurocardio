# NeyroCardio

Next.js sayt: UZ/RU tillari, tungi rejim, admin panel (`/admin`).

## Kompyuterda ishga tushirish
```
npm install
npm run dev
```
`.env.local` faylida `ADMIN_PASSWORD=...` bo'lishi kerak. Admin: http://localhost:3000/admin

Kompyuterda o'zgarishlar `data/site.json` va `data/uploads/` ga yoziladi.

## Netlify'da admin panel
1. **Parol:** Netlify → saytingiz → Site configuration → Environment variables → Add a variable  
   Key: `ADMIN_PASSWORD`, Value: parolingiz. (`.env.local` Netlify'ga yuklanmaydi, shuning uchun parolni shu yerga yozish shart.)
2. **Deploy:** o'zgarishlarni GitHub'ga push qiling yoki Deploys → Trigger deploy → Deploy site.
3. Netlify'da ma'lumotlar **Netlify Blobs**'da saqlanadi (sozlash shart emas). Admin panelda "Saqlash joyi: Netlify Blobs" yozuvi chiqsa, hammasi to'g'ri.

Netlify Blobs birinchi marta bo'sh bo'ladi: sayt `data/site.json` dagi ma'lumotlarni boshlang'ich sifatida oladi.
Shundan keyin Netlify'dagi admin paneldagi o'zgarishlar faqat Netlify'da saqlanadi (kompyuterdagi `data/site.json` ga ta'sir qilmaydi).

## Tillar
- Sayt matnlari: `app/lib/i18n.ts` (o'zbekcha va ruscha).
- Shifokorlar va videolarning ruscha matnlari: admin panelda ("Ruscha matnlar" bo'limi, video "Tahrirlash" tugmasi).

## Savol-javob chati va shifokor kabineti
- Chat bosh sahifadagi "Savollar" bo'limida. Bemor ismini kiritib yozadi.
- Shifokor kabineti: `/doctor`. Login va parolni admin beradi: `/admin` → Shifokorlar → Tahrirlash → "Shifokor kabineti va chat uchun kirish".
- Kabinetda shifokor o'z ma'lumotlarini (UZ/RU), rasmini va parolini o'zgartiradi.
- Shifokor kirgan holda chatda rasmi va rangi bilan yozadi, keraksiz xabarlarni o'chiradi.
- Ma'lumotlar Netlify'da Netlify Blobs'da, kompyuterda `data/kv/` papkasida saqlanadi (`data/kv/` GitHub'ga yuklanmaydi).

## Telegram Mini App (@neyrocardio_bot)
1. Netlify → Environment variables → `TELEGRAM_BOT_TOKEN` = BotFather bergan token → qayta deploy.
2. `/admin` → **Telegram** bo'limi → **Botni saytga ulash**. Webhook, menyu tugmasi, tavsiflar avtomatik o'rnatiladi.
3. Shifokorlar: botga kirib, pastdagi **NeyroCardio** tugmasi → "Shifokorlar uchun kirish" → login/parol → **Telegram'imni bog'lash**.
   Shundan keyin yangi savollar va qabul so'rovlari ularga Telegram'da keladi, Mini App'da parolsiz kiradi.
- Telegram ichida: tun/kun rejimi va til Telegram'dan olinadi, chatda ism avtomatik, "Orqaga" tugmasi ishlaydi.
- Bemor savoliga shifokor javob berganda, bemorga bot orqali xabar boradi.
- Telegram skripti faqat sayt Telegram ichida ochilganda yuklanadi; oddiy brauzerda sayt avvalgidek ishlaydi.
