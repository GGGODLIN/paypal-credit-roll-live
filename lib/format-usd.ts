// Locale APIs (toLocaleString / Intl) would make server and browser render different digits
// for the same cents, so grouping is done by hand.
export function formatUsdCents(cents: number): string {
  const rounded = Math.round(cents);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const dollars = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const remainder = (abs % 100).toString().padStart(2, '0');
  return `${sign}$${dollars}.${remainder}`;
}
