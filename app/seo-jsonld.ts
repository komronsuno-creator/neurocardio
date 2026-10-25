// Google uchun tuzilgan ma'lumot (schema.org JSON-LD). Sahifada ko'rinmaydi, faqat qidiruv tizimlari o'qiydi.
import type { Doctor } from "./lib/types";

const SITE = "https://neyrocardio.uz";
const abs = (u: string) => (u ? new URL(u, SITE).toString() : `${SITE}/icon.png`);

const ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: "Talabalar ko‘chasi, Real Medical klinikasi",
  addressLocality: "Toshkent",
  addressRegion: "Olmazor tumani",
  addressCountry: "UZ",
};
const GEO = { "@type": "GeoCoordinates", latitude: 41.351556, longitude: 69.212944 };

function specialty(d: Doctor) {
  const r = `${d.role} ${d.description}`.toLowerCase();
  if (r.includes("kardio") || r.includes("кардио")) return "Cardiovascular";
  if (r.includes("nevro") || r.includes("невро") || r.includes("neyro")) return "Neurologic";
  return undefined;
}

export function buildJsonLd(doctors: Doctor[]) {
  const clinicId = `${SITE}/#clinic`;
  const physicians = doctors.map((d) => ({
    "@type": "Physician",
    "@id": `${SITE}/#doctor-${d.id}`,
    name: d.name,
    alternateName: d.ru?.name,
    description: d.bio || d.description,
    jobTitle: d.role,
    medicalSpecialty: specialty(d),
    image: abs(d.image),
    telephone: d.phone,
    url: `${SITE}/?doctor=${d.id}`,
    address: ADDRESS,
    geo: GEO,
    sameAs: [d.telegram, d.instagram].filter(Boolean),
    worksFor: { "@id": clinicId },
  }));

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      url: SITE,
      name: "NeyroCardio",
      inLanguage: ["uz", "ru"],
      publisher: { "@id": clinicId },
    },
    {
      "@context": "https://schema.org",
      "@type": "MedicalClinic",
      "@id": clinicId,
      name: "NeyroCardio",
      alternateName: ["NeuroCardio", "НейроКардио", "Neyrokardio"],
      description:
        "Nevrolog va kardiolog shifokorlar: bosh og‘rig‘i, asab kasalliklari, yurak og‘rig‘i, qon bosimi, aritmiya. Невролог и кардиолог в Ташкенте.",
      url: SITE,
      logo: `${SITE}/icon.png`,
      image: doctors.map((d) => abs(d.image)),
      telephone: doctors[0]?.phone,
      address: ADDRESS,
      geo: GEO,
      hasMap: "https://www.google.com/maps/search/?api=1&query=41.351556,69.212944",
      medicalSpecialty: ["Neurologic", "Cardiovascular"],
      availableService: [
        "Nevrolog konsultatsiyasi", "Kardiolog konsultatsiyasi", "Bosh og‘rig‘i va migren", "Yurak og‘rig‘i",
        "Qon bosimi (gipertoniya)", "Aritmiya", "Консультация невролога", "Консультация кардиолога",
      ].map((name) => ({ "@type": "MedicalProcedure", name })),
      areaServed: { "@type": "City", name: "Toshkent" },
      sameAs: ["https://www.youtube.com/@Neurocardiouz", "https://t.me/neyrocardio_bot"],
      member: physicians.map((p) => ({ "@id": p["@id"] })),
    },
    ...physicians.map((p) => ({ "@context": "https://schema.org", ...p })),
  ];
}
