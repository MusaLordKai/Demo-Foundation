import type { ReactNode } from "react";

export type IconName =
  | "layers"
  | "folderOpen"
  | "files"
  | "barChart"
  | "clock"
  | "checkCircle"
  | "xCircle"
  | "target"
  | "wallet"
  | "trendingUp"
  | "dollar"
  | "pencil";

const PATHS: Record<IconName, ReactNode> = {
  layers: (
    <>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  folderOpen: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1H3z" />
      <path d="M3 10h18l-2 8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />
    </>
  ),
  files: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  barChart: (
    <>
      <path d="M3 20h18" />
      <path d="M6 20v-6M12 20V7M18 20v-9" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </>
  ),
  xCircle: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="17" cy="14" r="1.2" />
    </>
  ),
  trendingUp: (
    <>
      <path d="M3 17l6-6 4 4 7-7" />
      <path d="M17 8h4v4" />
    </>
  ),
  dollar: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5v9M14 9.5c0-1-1-1.6-2-1.6s-2 .5-2 1.5 1 1.3 2 1.5 2 .6 2 1.6-1 1.5-2 1.5-2-.6-2-1.5" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </>
  ),
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
