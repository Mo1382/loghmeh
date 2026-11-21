import Image from "next/image";
import LoginForm from "@/components/ui/Form/LoginForm";

export const metadata = {
  title: "ورود",
  description: "ورود به حساب کاربری لقمه",
};

export default function LoginPage() {
  return (
    <main
      className="
        flex justify-center items-center lg:justify-start w-full flex-col bg-neutral-2 lg:flex-row relative px-24 md:px-[80px] lg:px-0
      "
    >
      {/* Desktop illustration */}
      <div
        aria-hidden="true"
        className="
          fixed hidden
          shrink-0 overflow-hidden
          lg:block
          right-0 top-0 bottom-0
          w-1/2
        "
      >
        <Image
          src="/img/login-desktop.png"
          alt=""
          fill
          priority
          sizes="(min-width: 1440px) 678px, 0px"
          className="object-cover"
        />
      </div>

      <LoginForm />
    </main>
  );
}
