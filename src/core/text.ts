// Text normalisation shared by the verifier, the hard routes and the FAQ matcher.

const AR_DIACRITICS = /[ً-ٰٟـ]/g;

export function toAsciiDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x06F0))
    .replace(/٫/g, '.')   // Arabic decimal separator
    .replace(/٬/g, ',');  // Arabic thousands separator
}

export function toArabicDigits(s: string): string {
  return s.replace(/[0-9]/g, d => String.fromCharCode(0x0660 + Number(d)));
}

/** Lower-case, strip Arabic diacritics and tatweel, unify alef/ya/ta marbuta, ASCII digits. */
export function normalize(s: string): string {
  return toAsciiDigits(s)
    .toLowerCase()
    .replace(AR_DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export const hasArabic = (s: string) => /[؀-ۿ]/.test(s);
