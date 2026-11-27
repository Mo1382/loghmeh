import { LogInIcon } from "@/components/icons";

import AuthPageContent from "@/components/ui/Auth/AuthPageContent";
import AuthDesktopIllustration from "@/components/ui/Auth/AuthDesktopIllustration";
import LoginForm from "@/components/ui/Form/LoginForm";

export const metadata = {
  title: "ورود",
  description: "ورود به حساب کاربری لقمه",
};

export default function LoginPage() {
  return (
    <>
      <AuthDesktopIllustration />

      <AuthPageContent title="ورود" icon={LogInIcon} headingId="login-heading">
        <LoginForm />
      </AuthPageContent>
    </>
  );
}
