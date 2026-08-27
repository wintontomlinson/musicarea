import type { SVGProps } from 'react';

/**
 * Deliberately not annotated `Record<string, string>`: that widened `keyof` to
 * `string`, so `IconName` accepted anything and a misspelled icon rendered an
 * empty `<path>` with no compile error. Inference keeps the keys as literals.
 */
const paths = {
  home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z',
  search: 'M10.5 3a7.5 7.5 0 1 0 4.55 13.46l4.24 4.25 1.42-1.42-4.25-4.24A7.5 7.5 0 0 0 10.5 3m0 2a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11',
  library: 'M4 4h3v16H4zm5 0h3v16H9zm6.2.6 2.9-.8 4 15.4-2.9.8z',
  heart: 'M12 20.7 4.6 13.6a4.9 4.9 0 0 1 7-6.9l.4.4.4-.4a4.9 4.9 0 0 1 7 6.9z',
  clock: 'M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7v4l5-4-5-4zm-.9 5h1.6v4.6l3 1.8-.8 1.3-3.8-2.3z',
  chart: 'M4 20V10h4v10zm6 0V4h4v16zm6 0v-7h4v7z',
  play: 'M8 5.2 19 12 8 18.8z',
  pause: 'M7 5h3.5v14H7zm6.5 0H17v14h-3.5z',
  prev: 'M7 6h2v12H7zm3.5 6L19 6v12z',
  next: 'M15 6h2v12h-2zM5 6l8.5 6L5 18z',
  shuffle: 'M16 3h5v5h-2V6.4l-4.3 4.3-1.4-1.4L17.6 5H16zm-9.3 2.3 4 4-1.4 1.4-4-4zM19 15.6V14h2v5h-5v-2h1.6l-4.3-4.3 1.4-1.4zM8.7 13.3l1.4 1.4-4.4 4.4-1.4-1.4z',
  repeat: 'M7 7h9v2.5l4-3.5-4-3.5V5H5v7h2zm10 10H8v-2.5l-4 3.5 4 3.5V19h11v-7h-2z',
  // Same loop as `repeat` with a numeral 1 in the gap between the arrows. These
  // two were byte-identical path strings, so repeat-one was indistinguishable
  // from repeat-all on screen and the third state of the button was invisible.
  repeatOne:
    'M7 7h9v2.5l4-3.5-4-3.5V5H5v7h2zm10 10H8v-2.5l-4 3.5 4 3.5V19h11v-7h-2zm-4.1-7.5v5h-1.5v-3.6l-1.2.8-.6-1.1 2-1.1z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  queue: 'M4 6h11v2H4zm0 4h11v2H4zm0 4h7v2H4zm13-6 4 3-4 3z',
  collapse: 'M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z',
  close: 'M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 5.7 18.3 4.3 16.9 10.6 10.6 4.3 4.3 5.7 2.9 12 9.2l4.9-4.9z',
  volume: 'M4 9h3l4-4v14l-4-4H4zm11.5-1.3a5 5 0 0 1 0 8.6v-2A3 3 0 0 0 15.5 10z',
  volumeOff: 'M4 9h3l4-4v14l-4-4H4zm11 1.4 1.4-1.4L18.8 11l1.8-1.9 1.4 1.4-1.8 1.9 1.8 1.8-1.4 1.4-1.8-1.8-1.8 1.8-1.4-1.4 1.8-1.8z',
  drag: 'M9 4h2v2H9zm4 0h2v2h-2zM9 9h2v2H9zm4 0h2v2h-2zm-4 5h2v2h-2zm4 0h2v2h-2z',
  chevronRight: 'M8.6 4.6 16 12l-7.4 7.4-1.4-1.4L13.2 12l-6-6z',
  chevronLeft: 'M15.4 4.6 8 12l7.4 7.4 1.4-1.4L10.8 12l6-6z',
  gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4m-1.4-8h2.8l.4 2.5 1.5.9 2.3-1 1.4 2.4-1.9 1.6q.1.5.1 1t-.1 1l1.9 1.6-1.4 2.4-2.3-1-1.5.9-.4 2.5h-2.8l-.4-2.5-1.5-.9-2.3 1L3 15.4l1.9-1.6q-.1-.5-.1-1t.1-1L3 10.2l1.4-2.4 2.3 1 1.5-.9z',
  compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14m3.4 3.6-2.2 5.2-5.2 2.2 2.2-5.2z',
  disc: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16m0 3.5A4.5 4.5 0 1 0 12 16.5 4.5 4.5 0 0 0 12 7.5m0 2A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5m0 1.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2',
  sparkle: 'm12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8zm7 14 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8zM5 15l.7 2.3L8 18l-2.3.7L5 21l-.7-2.3L2 18l2.3-.7z',
  check: 'm9.4 16.6-4.2-4.2 1.4-1.4 2.8 2.8 7.8-7.8 1.4 1.4z',
  /* Added for the redesign. */
  expand: 'M16.6 15.4 12 10.8l-4.6 4.6L6 14l6-6 6 6z',
  mic: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3m7 8a7 7 0 0 1-6 6.93V21h-2v-3.07A7 7 0 0 1 5 11h2a5 5 0 0 0 10 0z',
  // Only the struck-through form is needed: the catalogue is audio only, so the video control
  // exists purely to report that it is unavailable.
  videoOff: 'M2.1 3.5 3.5 2.1l18.4 18.4-1.4 1.4-2.9-2.9H4a2 2 0 0 1-2-2V7a2 2 0 0 1 .8-1.6zM7.5 5H15a2 2 0 0 1 2 2v1.9l5-2.9v12l-2-1.2V7.9l-3 1.7V12z',
  lyrics: 'M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9.5L5 20.5V17H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m3 4v2h10V8zm0 4v2h7v-2z',
  // Broadcast tower, for stations and the DJ card.
  radio: 'M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5M7.8 6.2 9.2 7.6a5 5 0 0 0 0 6.8l-1.4 1.4a7 7 0 0 1 0-9.6m8.4 0a7 7 0 0 1 0 9.6l-1.4-1.4a5 5 0 0 0 0-6.8zM4.9 3.3l1.4 1.4a9 9 0 0 0 0 12.6l-1.4 1.4a11 11 0 0 1 0-15.4m14.2 0a11 11 0 0 1 0 15.4l-1.4-1.4a9 9 0 0 0 0-12.6z',
  share: 'M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14zM5 6h5v2H6v10h10v-4h2v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1',
  // Portrait card with a play glyph, for the vertical samples feed.
  samples: 'M8 2h8a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3m2.5 6.2v7.6L16 12z',
  user: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 10c4.4 0 8 2.2 8 5v1H4v-1c0-2.8 3.6-5 8-5',
  // Queue glyph with the arrow at the top rather than the bottom, so "play next"
  // and "add to queue" are distinguishable at 16px.
  playNext: 'M4 6h10v2H4zm0 4h10v2H4zm0 4h7v2H4zm12-9 5 4-5 4z',
  bolt: 'M13 2 5 13h5l-1 9 9-12h-5l1-8z',
} as const satisfies Record<string, string>;

export type IconName = keyof typeof paths;

interface IconProps extends SVGProps<SVGSVGElement> { name: IconName; size?: number; }

export function Icon({ name, size = 22, ...rest }: IconProps) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" {...rest}><path d={paths[name]} /></svg>;
}
