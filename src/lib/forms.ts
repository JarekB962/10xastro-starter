export const INVALID_FORM_MESSAGE = "Niepoprawne dane formularza.";

/** Adres przekierowania z komunikatem błędu w `?error=` (wzorzec z tras logowania); `keep` odsyła wpisane wartości formularza. */
export function errorUrl(path: string, message: string, keep?: Record<string, string>): string {
  const params = new URLSearchParams({ error: message, ...keep });
  return `${path}?${params.toString()}`;
}

/** Odczytuje dane formularza; `null`, gdy treść żądania nie jest formularzem (zamiast wyjątku i błędu 500). */
export async function readForm(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}
