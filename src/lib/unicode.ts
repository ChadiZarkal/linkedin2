// src/lib/unicode.ts
// Convert Markdown-style formatting to Unicode characters for LinkedIn
// LinkedIn doesn't render **bold** or *italic* — we use Unicode math symbols instead

// Mathematical Sans-Serif Bold (U+1D5D4 range)
const BOLD_UPPER = "𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭";
const BOLD_LOWER = "𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇";
const BOLD_DIGITS = "𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵";

// Mathematical Sans-Serif Italic (U+1D608 range)
const ITALIC_UPPER = "𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡";
const ITALIC_LOWER = "𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻";

// Mathematical Sans-Serif Bold Italic
const BOLD_ITALIC_UPPER = "𝘼𝘽𝘾𝘿𝙀𝙁𝙂𝙃𝙄𝙅𝙆𝙇𝙈𝙉𝙊𝙋𝙌𝙍𝙎𝙏𝙐𝙑𝙒𝙓𝙔𝙕";
const BOLD_ITALIC_LOWER = "𝙖𝙗𝙘𝙙𝙚𝙛𝙜𝙝𝙞𝙟𝙠𝙡𝙢𝙣𝙤𝙥𝙦𝙧𝙨𝙩𝙪𝙫𝙬𝙭𝙮𝙯";

function toBoldChar(ch: string): string {
  const code = ch.charCodeAt(0);
  if (code >= 65 && code <= 90) return [...BOLD_UPPER][code - 65]; // A-Z
  if (code >= 97 && code <= 122) return [...BOLD_LOWER][code - 97]; // a-z
  if (code >= 48 && code <= 57) return [...BOLD_DIGITS][code - 48]; // 0-9
  return ch;
}

function toItalicChar(ch: string): string {
  const code = ch.charCodeAt(0);
  if (code >= 65 && code <= 90) return [...ITALIC_UPPER][code - 65];
  if (code >= 97 && code <= 122) return [...ITALIC_LOWER][code - 97];
  return ch;
}

function toBoldItalicChar(ch: string): string {
  const code = ch.charCodeAt(0);
  if (code >= 65 && code <= 90) return [...BOLD_ITALIC_UPPER][code - 65];
  if (code >= 97 && code <= 122) return [...BOLD_ITALIC_LOWER][code - 97];
  return ch;
}

function convertChars(text: string, converter: (ch: string) => string): string {
  return [...text].map(converter).join("");
}

/**
 * Convert Markdown-style formatting to LinkedIn-compatible Unicode.
 * 
 * Supported:
 * - `***text***` or `___text___` → Bold Italic
 * - `**text**` or `__text__` → Bold  
 * - `*text*` or `_text_` → Italic
 * - `# Heading` → Bold heading
 * - `- item` or `• item` → keeps bullet
 */
export function formatForLinkedIn(text: string): string {
  let result = text;

  // Bold Italic: ***text*** or ___text___
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, (_, content) => convertChars(content, toBoldItalicChar));
  result = result.replace(/___(.+?)___/g, (_, content) => convertChars(content, toBoldItalicChar));

  // Bold: **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, (_, content) => convertChars(content, toBoldChar));
  result = result.replace(/__(.+?)__/g, (_, content) => convertChars(content, toBoldChar));

  // Italic: *text* or _text_ (avoid matching already-converted or emoji sequences)
  result = result.replace(/(?<!\w)\*([^*\n]+?)\*(?!\w)/g, (_, content) => convertChars(content, toItalicChar));
  result = result.replace(/(?<!\w)_([^_\n]+?)_(?!\w)/g, (_, content) => convertChars(content, toItalicChar));

  // Headings: # Heading → Bold
  result = result.replace(/^#{1,3}\s+(.+)$/gm, (_, content) => convertChars(content.trim(), toBoldChar));

  return result;
}

/**
 * Preview: show what the formatted text will look like.
 * Returns { formatted, changeCount } for UI feedback.
 */
export function previewLinkedInFormat(text: string): { formatted: string; changeCount: number } {
  const formatted = formatForLinkedIn(text);
  // Count formatting markers removed
  const boldCount = (text.match(/\*\*[^*]+\*\*/g) || []).length;
  const italicCount = (text.match(/(?<!\*)\*[^*\n]+\*(?!\*)/g) || []).length;
  const headingCount = (text.match(/^#{1,3}\s+/gm) || []).length;
  return { formatted, changeCount: boldCount + italicCount + headingCount };
}
