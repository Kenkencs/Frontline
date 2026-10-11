export interface ManagerContact {
  name: string;
  phone: string;
  contactLabel: string;
  demo: boolean;
  phoneHref: string | null;
  contactHref: string | null;
}

// Fail closed: placeholder contacts and unsafe protocols never become links.
export function safePhoneHref(phone: string): string | null {
  const number = phone.replace(/[\s()-]/g, "");
  return /^\+?[0-9]{7,15}$/.test(number) ? `tel:${number}` : null;
}

export function safeContactHref(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
