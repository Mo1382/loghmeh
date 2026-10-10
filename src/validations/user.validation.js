export const usernameSchema = z
  .string()
  .trim()
  .transform(normalizeUsername)
  .min(3, "نام کاربری باید حداقل ۳ کاراکتر باشد.")
  .max(30, "نام کاربری نباید بیشتر از ۳۰ کاراکتر باشد.")
  .regex(
    USERNAME_PATTERN,
    "نام کاربری فقط می‌تواند شامل حروف انگلیسی، حروف فارسی، ارقام انگلیسی و زیرخط باشد."
  );
