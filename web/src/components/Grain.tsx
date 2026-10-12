import { useId } from "react";

/** Subtle paper grain over the page (decorative). */
export function Grain() {
  const id = useId().replace(/:/g, "");
  return (
    <svg aria-hidden="true" className="grain">
      <filter id={`grain-${id}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#grain-${id})`} />
    </svg>
  );
}
