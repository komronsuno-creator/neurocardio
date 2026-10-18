// Yupqa chiziqli SVG belgilar (emoji o'rniga): har qanday ekranda bir xil va toza ko'rinadi.
export type IconName =
  | "brain"
  | "heart"
  | "shield"
  | "moon"
  | "stethoscope"
  | "flask"
  | "play"
  | "send"
  | "youtube";

const PATHS: Record<IconName, React.ReactNode> = {
  brain: (
    <>
      <path d="M9.5 3.5A2.5 2.5 0 0 0 7 6a2.5 2.5 0 0 0-2.4 3.2A3 3 0 0 0 4 14a3 3 0 0 0 2 2.8V17a3 3 0 0 0 3.5 3 2.5 2.5 0 0 0 2.5-2.5v-11A2.5 2.5 0 0 0 9.5 3.5Z" />
      <path d="M14.5 3.5A2.5 2.5 0 0 1 17 6a2.5 2.5 0 0 1 2.4 3.2A3 3 0 0 1 20 14a3 3 0 0 1-2 2.8V17a3 3 0 0 1-3.5 3 2.5 2.5 0 0 1-2.5-2.5" />
      <path d="M7 9.5c1 .2 2 .9 2.4 2M17 9.5c-1 .2-2 .9-2.4 2M7.5 14.5c.8 0 1.6.4 2 1M16.5 14.5c-.8 0-1.6.4-2 1" />
    </>
  ),
  heart: (
    <>
      <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />
      <path d="M4.8 12.5h3.6l1.5-2.5 2.2 4.5 1.6-2h5.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.2 5 6v5.6c0 4.3 3 7.7 7 9.2 4-1.5 7-4.9 7-9.2V6l-7-2.8Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  moon: (
    <>
      <path d="M19.5 14.3A7.8 7.8 0 0 1 9.7 4.5a7.8 7.8 0 1 0 9.8 9.8Z" />
      <path d="M16 4.5v3M14.5 6h3" />
    </>
  ),
  stethoscope: (
    <>
      <path d="M6 3.5H5a1 1 0 0 0-1 1v4a5 5 0 0 0 10 0v-4a1 1 0 0 0-1-1h-1" />
      <path d="M9 13.5v1.5a5 5 0 0 0 10 0v-2" />
      <circle cx="19" cy="11" r="2" />
    </>
  ),
  flask: (
    <>
      <path d="M9.5 3.5h5M10.5 3.5v5.2L5.3 17.4A2 2 0 0 0 7 20.5h10a2 2 0 0 0 1.7-3.1l-5.2-8.7V3.5" />
      <path d="M7.5 14.5h9" />
    </>
  ),
  play: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="4" />
      <path d="m10.5 9.3 4.2 2.7-4.2 2.7V9.3Z" />
    </>
  ),
  send: (
    <>
      <path d="M20.5 4 3.8 10.6c-.8.3-.8 1.4 0 1.7l4.2 1.5 1.6 5.1c.2.7 1.1.9 1.6.4l2.4-2.3 4.3 3.1c.6.4 1.4.1 1.6-.6L21.6 5.2c.2-.8-.5-1.5-1.1-1.2Z" />
      <path d="m8 13.8 9-6.3-6.4 7.4" />
    </>
  ),
  youtube: (
    <>
      <path d="M21 8.2a2.8 2.8 0 0 0-2-2c-1.7-.5-7-.5-7-.5s-5.3 0-7 .5a2.8 2.8 0 0 0-2 2A29 29 0 0 0 2.6 12a29 29 0 0 0 .4 3.8 2.8 2.8 0 0 0 2 2c1.7.5 7 .5 7 .5s5.3 0 7-.5a2.8 2.8 0 0 0 2-2 29 29 0 0 0 .4-3.8 29 29 0 0 0-.4-3.8Z" />
      <path d="m10 9.2 4.8 2.8L10 14.8V9.2Z" />
    </>
  ),
};

export default function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={`ico${className ? ` ${className}` : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
