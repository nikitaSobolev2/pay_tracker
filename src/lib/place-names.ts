/** Localized country name from ISO 3166-1 alpha-2 (e.g. RU → Россия). */
export function localizedCountryName(isoCode: string, locale: string): string {
  const code = isoCode.trim().toUpperCase();
  if (!code) {
    return isoCode;
  }
  try {
    return (
      new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code
    );
  } catch {
    return code;
  }
}
