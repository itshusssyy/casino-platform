// Country dial codes for the signup phone field. `code` is ISO 3166-1 alpha-2.
export type Country = { code: string; name: string; dial: string };

export const COUNTRIES: Country[] = [
  { code: "US", name: "United States", dial: "1" },
  { code: "CA", name: "Canada", dial: "1" },
  { code: "GB", name: "United Kingdom", dial: "44" },
  { code: "PK", name: "Pakistan", dial: "92" },
  { code: "IN", name: "India", dial: "91" },
  { code: "BD", name: "Bangladesh", dial: "880" },
  { code: "AE", name: "United Arab Emirates", dial: "971" },
  { code: "SA", name: "Saudi Arabia", dial: "966" },
  { code: "QA", name: "Qatar", dial: "974" },
  { code: "KW", name: "Kuwait", dial: "965" },
  { code: "OM", name: "Oman", dial: "968" },
  { code: "BH", name: "Bahrain", dial: "973" },
  { code: "AU", name: "Australia", dial: "61" },
  { code: "NZ", name: "New Zealand", dial: "64" },
  { code: "IE", name: "Ireland", dial: "353" },
  { code: "DE", name: "Germany", dial: "49" },
  { code: "FR", name: "France", dial: "33" },
  { code: "ES", name: "Spain", dial: "34" },
  { code: "IT", name: "Italy", dial: "39" },
  { code: "PT", name: "Portugal", dial: "351" },
  { code: "NL", name: "Netherlands", dial: "31" },
  { code: "BE", name: "Belgium", dial: "32" },
  { code: "CH", name: "Switzerland", dial: "41" },
  { code: "AT", name: "Austria", dial: "43" },
  { code: "SE", name: "Sweden", dial: "46" },
  { code: "NO", name: "Norway", dial: "47" },
  { code: "DK", name: "Denmark", dial: "45" },
  { code: "FI", name: "Finland", dial: "358" },
  { code: "PL", name: "Poland", dial: "48" },
  { code: "CZ", name: "Czechia", dial: "420" },
  { code: "RO", name: "Romania", dial: "40" },
  { code: "GR", name: "Greece", dial: "30" },
  { code: "TR", name: "Türkiye", dial: "90" },
  { code: "UA", name: "Ukraine", dial: "380" },
  { code: "RU", name: "Russia", dial: "7" },
  { code: "MX", name: "Mexico", dial: "52" },
  { code: "BR", name: "Brazil", dial: "55" },
  { code: "AR", name: "Argentina", dial: "54" },
  { code: "CL", name: "Chile", dial: "56" },
  { code: "CO", name: "Colombia", dial: "57" },
  { code: "PE", name: "Peru", dial: "51" },
  { code: "VE", name: "Venezuela", dial: "58" },
  { code: "DO", name: "Dominican Republic", dial: "1" },
  { code: "PR", name: "Puerto Rico", dial: "1" },
  { code: "JM", name: "Jamaica", dial: "1" },
  { code: "TT", name: "Trinidad and Tobago", dial: "1" },
  { code: "PH", name: "Philippines", dial: "63" },
  { code: "MY", name: "Malaysia", dial: "60" },
  { code: "SG", name: "Singapore", dial: "65" },
  { code: "ID", name: "Indonesia", dial: "62" },
  { code: "TH", name: "Thailand", dial: "66" },
  { code: "VN", name: "Vietnam", dial: "84" },
  { code: "CN", name: "China", dial: "86" },
  { code: "HK", name: "Hong Kong", dial: "852" },
  { code: "JP", name: "Japan", dial: "81" },
  { code: "KR", name: "South Korea", dial: "82" },
  { code: "NP", name: "Nepal", dial: "977" },
  { code: "LK", name: "Sri Lanka", dial: "94" },
  { code: "AF", name: "Afghanistan", dial: "93" },
  { code: "IR", name: "Iran", dial: "98" },
  { code: "IQ", name: "Iraq", dial: "964" },
  { code: "JO", name: "Jordan", dial: "962" },
  { code: "LB", name: "Lebanon", dial: "961" },
  { code: "IL", name: "Israel", dial: "972" },
  { code: "EG", name: "Egypt", dial: "20" },
  { code: "MA", name: "Morocco", dial: "212" },
  { code: "DZ", name: "Algeria", dial: "213" },
  { code: "TN", name: "Tunisia", dial: "216" },
  { code: "NG", name: "Nigeria", dial: "234" },
  { code: "GH", name: "Ghana", dial: "233" },
  { code: "KE", name: "Kenya", dial: "254" },
  { code: "ZA", name: "South Africa", dial: "27" },
  { code: "ET", name: "Ethiopia", dial: "251" },
];

export const countryByCode = (code: string) => COUNTRIES.find((c) => c.code === code);

/** Builds an E.164 number (+15551234567) from a country and a locally typed number, or null if invalid. */
export function toE164(countryCode: string, local: string): string | null {
  const c = countryByCode(countryCode);
  if (!c) return null;
  let digits = local.replace(/\D/g, "");
  if (digits.startsWith(c.dial) && digits.length > c.dial.length + 6) digits = digits.slice(c.dial.length); // pasted with code
  digits = digits.replace(/^0+/, ""); // national trunk prefix, e.g. 0300… in Pakistan
  const full = c.dial + digits;
  return digits.length >= 6 && full.length <= 15 ? `+${full}` : null;
}
