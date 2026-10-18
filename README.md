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
