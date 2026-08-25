import type { SVGProps } from 'react';

/**
 * A small inline icon set. Icons are simple SVG paths so they inherit color and
 * need no external dependency. Each is decorative by default; callers that use
 * an icon as the sole content of a button must supply an aria-label there.
 */
const paths: Record<string, string> = {
  home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z',
  search:
    'M10.5 3a7.5 7.5 0 1 0 4.55 13.46l4.24 4.25 1.42-1.42-4.25-4.24A7.5 7.5 0 0 0 10.5 3m0 2a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11',
  library: 'M4 4h3v16H4zm5 0h3v16H9zm6.2.6 2.9-.8 4 15.4-2.9.8z',
  heart:
    'M12 20.7 4.6 13.6a4.9 4.9 0 0 1 7-6.9l.4.4.4-.4a4.9 4.9 0 0 1 7 6.9z',
  clock:
    'M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7v4l5-4-5-4zm-.9 5h1.6v4.6l3 1.8-.8 1.3-3.8-2.3z',
  fire: 'M12 2c1 3-1 5-2 7s0 4 2 4 3-2 2-4c3 1 4 4 4 6a6 6 0 1 1-12 0c0-3 2-5 3-7s2-4 0-6z',
  chart: 'M4 20V10h4v10zm6 0V4h4v16zm6 0v-7h4v7z',
  play: 'M8 5.2 19 12 8 18.8z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  bell: 'M12 3a6 6 0 0 0-6 6v4l-2 3v1h16v-1l-2-3V9a6 6 0 0 0-6-6m0 19a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3',
  chevronRight: 'M8.6 4.6 16 12l-7.4 7.4-1.4-1.4L13.2 12l-6-6z',
  chevronLeft: 'M15.4 4.6 8 12l7.4 7.4 1.4-1.4L10.8 12l6-6z',
  gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8m0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4m-1.4-8h2.8l.4 2.5 1.5.9 2.3-1 1.4 2.4-1.9 1.6q.1.5.1 1t-.1 1l1.9 1.6-1.4 2.4-2.3-1-1.5.9-.4 2.5h-2.8l-.4-2.5-1.5-.9-2.3 1L3 15.4l1.9-1.6q-.1-.5-.1-1t.1-1L3 10.2l1.4-2.4 2.3 1 1.5-.9z',
  compass:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14m3.4 3.6-2.2 5.2-5.2 2.2 2.2-5.2z',
};

export type IconName = keyof typeof paths;

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 22, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  );
}
