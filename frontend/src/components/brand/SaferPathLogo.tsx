interface LogoProps {
  size?: number;
  className?: string;
  variant?: "full" | "mark";
  /** When true, renders white text suitable for dark backgrounds */
  inverted?: boolean;
}

/**
 * Official SaferPath brand logo.
 * - "mark" variant: Icon only (shield-compass shape)
 * - "full" variant: Icon + wordmark
 */
export function SaferPathLogo({
  size = 32,
  className = "",
  variant = "full",
  inverted = false,
}: LogoProps) {
  const textColor = inverted ? "#ffffff" : "var(--ink, #14231d)";
  const teal = "var(--teal, #16756c)";

  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
      aria-label="SaferPath"
    >
      {/* Shield-compass mark */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Shield shape */}
        <path
          d="M20 3L5 10V22C5 31 20 38 20 38C20 38 35 31 35 22V10L20 3Z"
          fill={teal}
        />
        {/* Inner compass rose */}
        <circle
          cx="20"
          cy="20"
          r="9"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.5"
          opacity="0.4"
        />
        {/* Compass needle N-S */}
        <path d="M20 12L22 20L20 22L18 20Z" fill="#ffffff" opacity="0.95" />
        <path d="M20 28L18 20L20 18L22 20Z" fill="#ffffff" opacity="0.5" />
        {/* Compass needle E-W */}
        <path d="M28 20L20 18L18 20L20 22Z" fill="#ffffff" opacity="0.5" />
        <path d="M12 20L20 22L22 20L20 18Z" fill="#ffffff" opacity="0.95" />
        {/* Center dot */}
        <circle cx="20" cy="20" r="2" fill="#ffffff" />
      </svg>

      {variant === "full" && (
        <span
          className="font-serif text-xl font-bold tracking-tight"
          style={{ color: textColor }}
        >
          SaferPath
        </span>
      )}
    </span>
  );
}
