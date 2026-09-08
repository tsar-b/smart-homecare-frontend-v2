/** A blank value keeps the stored quote; malformed values must never become a lower quote. */
export function parseAdminPrice(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(normalized)) {
    throw new Error('Price must be a whole non-negative amount.');
  }
  const price = Number(normalized.replace(/,/g, ''));
  if (!Number.isSafeInteger(price)) throw new Error('Price is outside the supported range.');
  return price;
}

export function selectedAddressPatch(address: string, detail?: string) {
  return { address: address.trim(), addressDetail: detail?.trim() || '' };
}
