import AuthFormGroup from "@/components/ui/Form/AuthFormGroup";
import LoginForm from "@/components/ui/Form/LoginForm";

export const metadata = {
  title: "ورود",
  description: "ورود به حساب کاربری لقمه",
};

export default function LoginPage() {
  return (
    <div className="">
      <LoginForm />
    </div>
  );
}
