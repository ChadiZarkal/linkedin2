// ============================================================
// Unicode text formatting for LinkedIn
// Converts **bold** and *italic* to Unicode characters
// ============================================================

const BOLD_MAP: Record<string, string> = {};
const ITALIC_MAP: Record<string, string> = {};

// Bold: Mathematical Bold (U+1D400–U+1D433)
const boldUpper = 0x1D400;
const boldLower = 0x1D41A;
for (let i = 0; i < 26; i++) {
  BOLD_MAP[String.fromCharCode(65 + i)] = String.fromCodePoint(boldUpper + i);
  BOLD_MAP[String.fromCharCode(97 + i)] = String.fromCodePoint(boldLower + i);
}
// Bold digits (U+1D7CE–U+1D7D7)
for (let i = 0; i < 10; i++) {
  BOLD_MAP[String.fromCharCode(48 + i)] = String.fromCodePoint(0x1D7CE + i);
}

// Italic: Mathematical Italic (U+1D434–U+1D467)
const italicUpper = 0x1D434;
const italicLower = 0x1D44E;
for (let i = 0; i < 26; i++) {
  ITALIC_MAP[String.fromCharCode(65 + i)] = String.fromCodePoint(italicUpper + i);
  ITALIC_MAP[String.fromCharCode(97 + i)] = String.fromCodePoint(italicLower + i);
}
// Fix: italic 'h' is special (U+210E)
ITALIC_MAP['h'] = String.fromCodePoint(0x210E);

function toBold(text: string): string {
  return [...text].map(c => BOLD_MAP[c] || c).join('');
}

function toItalic(text: string): string {
  return [...text].map(c => ITALIC_MAP[c] || c).join('');
}

export function formatLinkedInText(text: string): string {
  // Bold: **text** or __text__
  let result = text.replace(/\*\*(.+?)\*\*/g, (_, p1) => toBold(p1));
  result = result.replace(/__(.+?)__/g, (_, p1) => toBold(p1));
  
  // Italic: *text* (but not inside URLs or paths)
  result = result.replace(/(?<!\w)\*(.+?)\*(?!\w)/g, (_, p1) => toItalic(p1));
  // Don't apply _italic_ to avoid breaking URLs with underscores

  return result;
}
