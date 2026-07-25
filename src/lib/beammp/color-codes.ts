// BeamMP server-name color codes.
// BeamMP supports ^-prefixed color codes in the Name field, similar to Quake/Source engine conventions.
// These render in the BeamMP server browser list.

export interface ColorCode {
  code: string; // e.g. "^1"
  name: string;
  hex: string; // approximate render color
}

export const BEAMMP_COLOR_CODES: ColorCode[] = [
  { code: "^0", name: "Black", hex: "#000000" },
  { code: "^1", name: "Red", hex: "#FF3B30" },
  { code: "^2", name: "Green", hex: "#34C759" },
  { code: "^3", name: "Yellow", hex: "#FFCC00" },
  { code: "^4", name: "Blue", hex: "#0A84FF" },
  { code: "^5", name: "Cyan", hex: "#32D7FF" },
  { code: "^6", name: "Magenta", hex: "#FF2D92" },
  { code: "^7", name: "White", hex: "#FFFFFF" },
  { code: "^8", name: "Orange", hex: "#FF9500" },
  { code: "^9", name: "Gray", hex: "#8E8E93" },
  { code: "^a", name: "Lime", hex: "#B6FF00" },
  { code: "^b", name: "Sky", hex: "#5AC8FA" },
  { code: "^c", name: "Pink", hex: "#FF6AD5" },
  { code: "^d", name: "Violet", hex: "#BF5AF2" },
  { code: "^e", name: "Gold", hex: "#FFD60A" },
  { code: "^r", name: "Reset", hex: "" }, // resets to default color
];

/**
 * Renders a BeamMP color-coded name to React-friendly segments.
 * Each segment has the raw text and an optional color hex.
 */
export interface NameSegment {
  text: string;
  hex?: string;
}

export function parseColorCodedName(input: string): NameSegment[] {
  const segments: NameSegment[] = [];
  let currentColor: string | undefined;
  let buffer = "";
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === "^" && i + 1 < input.length) {
      const code = input[i + 1].toLowerCase();
      const match = BEAMMP_COLOR_CODES.find((c) => c.code === `^${code}`);
      if (match) {
        if (buffer) {
          segments.push({ text: buffer, hex: currentColor });
          buffer = "";
        }
        if (code === "r") {
          currentColor = undefined;
        } else {
          currentColor = match.hex || undefined;
        }
        i += 2;
        continue;
      }
    }
    buffer += ch;
    i += 1;
  }
  if (buffer) {
    segments.push({ text: buffer, hex: currentColor });
  }
  return segments;
}

/**
 * Strips color codes from a name for plain-text contexts (e.g. copy-to-clipboard, Discord share).
 */
export function stripColorCodes(input: string): string {
  return input.replace(/\^[0-9a-z]/gi, "");
}
