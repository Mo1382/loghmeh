import { LogInIcon } from "@/components/icons";

import AuthPageContent from "@/components/ui/Auth/AuthPageContent";
import LoginDesktopIllustration from "@/components/ui/Auth/LoginDesktopIllustration";
import RegisterForm from "@/components/ui/Form/RegisterForm";

export const metadata = {
  title: "ثبت‌نام",
  description: "ایجاد حساب کاربری در لقمه",
};

export default function RegisterPage() {
  return (
    <>
      <LoginDesktopIllustration />

      <AuthPageContent
        title="ثبت‌نام"
        icon={LogInIcon}
        headingId="register-heading"
        centerVertically
      >
        <RegisterForm />
      </AuthPageContent>
    </>
  );
}
