import React from 'react';

type LogoPixelatedSimpleProps = {
  className?: string;
};

export function LogoPixelatedSimple({ className }: LogoPixelatedSimpleProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      className={className}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="
          M11 0 h2 v4 h-2 Z
          M11 6 h2 v2 h-2 Z
          M0 11 h4 v2 h-4 Z
          M6 11 h2 v2 h-2 Z
          M20 11 h4 v2 h-4 Z
          M16 11 h2 v2 h-2 Z
          M3 3 h2 v2 h-2 Z
          M7 7 h2 v2 h-2 Z
          M19 3 h2 v2 h-2 Z
          M15 7 h2 v2 h-2 Z
          M3 19 h2 v2 h-2 Z
          M7 15 h2 v2 h-2 Z
        "
        fill="#000000"
        stroke="#ffffff"
        strokeWidth="2"
        paintOrder="stroke fill"
        strokeLinejoin="miter"
        strokeMiterlimit="10"
      />
      <path
        d="
          M12 12
          v17
          h1 v-1 h1 v-1 h1 v-1 h1 v-1
          h1 v2 h1 v3 h1 v2
          h2 v-1 h1 v-1
          h-1 v-2 h-1 v-2 h-1 v-2
          h4 v-1
          h-1 v-1 h-1 v-1 h-1 v-1 h-1 v-1 h-1 v-1 h-1 v-1 h-1 v-1 h-1 v-1 h-1 v-1 h-1 v-1 h-1 v-1
          Z
        "
        fill="#000000"
        stroke="#ffffff"
        strokeWidth="2"
        paintOrder="stroke fill"
        strokeLinejoin="miter"
        strokeMiterlimit="10"
      />
    </svg>
  );
}
