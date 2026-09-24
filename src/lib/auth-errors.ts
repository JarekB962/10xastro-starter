const MESSAGES: Record<string, string> = {
  user_already_exists: "Konto z tym adresem email już istnieje",
  email_exists: "Konto z tym adresem email już istnieje",
  invalid_credentials: "Nieprawidłowy email lub hasło",
  email_not_confirmed: "Adres email nie został jeszcze potwierdzony",
  weak_password: "Hasło jest zbyt słabe",
  email_address_invalid: "Podaj poprawny adres email",
  signup_disabled: "Rejestracja jest wyłączona",
  over_request_rate_limit: "Zbyt wiele prób, spróbuj ponownie za chwilę",
  over_email_send_rate_limit: "Zbyt wiele prób, spróbuj ponownie za chwilę",
};

export function authErrorMessage(error: { code?: string; message: string }): string {
  const translated = error.code ? MESSAGES[error.code] : undefined;
  return translated ?? error.message;
}
