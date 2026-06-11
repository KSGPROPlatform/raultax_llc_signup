// Self-contained SVG spinner — animates via SMIL so it needs no global CSS.
export function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ verticalAlign: "-3px", marginRight: 8 }}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M12 3 a9 9 0 0 1 9 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="0.7s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}
