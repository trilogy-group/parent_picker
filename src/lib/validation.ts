/**
 * Form validation and sanitization for suggest location forms.
 */

/** Strip HTML tags, trim whitespace */
export function sanitizeText(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

export function validateAddress(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Street address is required";
  if (trimmed.length < 3) return "Address must be at least 3 characters";
  if (trimmed.length > 200) return "Address must be under 200 characters";
  return null;
}

export function validateCity(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "City is required";
  if (trimmed.length > 100) return "City must be under 100 characters";
  return null;
}

export function validateState(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "State is required";
  if (!/^[A-Z]{2}$/.test(trimmed)) return "State must be 2 uppercase letters (e.g. TX)";
  return null;
}

export function validateSqft(value: string): string | null {
  if (!value.trim()) return null; // optional
  const cleaned = value.replace(/,/g, "");
  if (!/^\d+$/.test(cleaned)) return "Square footage must be a number";
  return null;
}

export function validateNotes(value: string, maxLength = 2000): string | null {
  if (value.length > maxLength) return `Notes must be under ${maxLength} characters`;
  return null;
}

export interface FormErrors {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  sqft?: string | null;
  notes?: string | null;
}

export function validateSuggestForm(fields: {
  address: string;
  city: string;
  state: string;
  sqft?: string;
  notes?: string;
}): FormErrors {
  return {
    address: validateAddress(fields.address),
    city: validateCity(fields.city),
    state: validateState(fields.state),
    sqft: fields.sqft != null ? validateSqft(fields.sqft) : null,
    notes: fields.notes != null ? validateNotes(fields.notes) : null,
  };
}

export function hasErrors(errors: FormErrors): boolean {
  return Object.values(errors).some((v) => v != null);
}
