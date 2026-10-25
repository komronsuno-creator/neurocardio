import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Shifokor kabineti — NeyroCardio" },
  robots: { index: false, follow: false },
};

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
