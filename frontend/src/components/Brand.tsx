/**
 * The Demo Foundation brand lockup: a bespoke gold "bloom" emblem (growth &
 * community) plus the wordmark. Reused on the login screen and in the header.
 */

const PETAL_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="brand-mark"
    >
      <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
      <circle cx="32" cy="32" r="24.5" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      {PETAL_ANGLES.map((a) => (
        <ellipse
          key={a}
          cx="32"
          cy="15.5"
          rx="3.4"
          ry="9.2"
          fill="currentColor"
          transform={`rotate(${a} 32 32)`}
          opacity={a % 90 === 0 ? 0.95 : 0.7}
        />
      ))}
      <circle cx="32" cy="32" r="4.6" fill="currentColor" />
      <circle cx="32" cy="32" r="2" fill="var(--surface, #fff)" />
    </svg>
  );
}

interface BrandProps {
  /** "full" shows the emblem + wordmark; "mark" is the emblem only. */
  variant?: "full" | "mark";
  size?: number;
  tagline?: boolean;
  /** Layout: "row" (header) or "stack" (login hero). */
  orientation?: "row" | "stack";
}

export function Brand({ variant = "full", size = 44, tagline = false, orientation = "row" }: BrandProps) {
  if (variant === "mark") return <BrandMark size={size} />;
  return (
    <div className={`brand brand-${orientation}`}>
      <BrandMark size={size} />
      <div className="brand-words">
        <span className="brand-overline">The</span>
        <span className="brand-name">Demo Foundation</span>
        {tagline && <span className="brand-tagline">Funding brighter futures for communities</span>}
      </div>
    </div>
  );
}
