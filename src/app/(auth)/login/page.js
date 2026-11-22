import { LogInIcon } from "@/components/icons";

import AuthPageContent from "@/components/ui/Auth/AuthPageContent";
import LoginDesktopIllustration from "@/components/ui/Auth/LoginDesktopIllustration";
import LoginForm from "@/components/ui/Form/LoginForm";

export const metadata = {
  title: "ورود",
  description: "ورود به حساب کاربری لقمه",
};

export default function LoginPage() {
  return (
    <>
      <LoginDesktopIllustration />

      <AuthPageContent title="ورود" icon={LogInIcon} headingId="login-heading">
        <LoginForm />
      </AuthPageContent>
    </>
  );
}
