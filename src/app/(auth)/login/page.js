import Image from "next/image";
import LoginForm from "@/components/ui/Form/LoginForm";
import { LogInIcon } from "@/components/icons";

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

      <section
        className="
        relative flex min-h-dvh w-full flex-col
        items-center justify-center bg-neutral-2

        md:max-w-[608px]

        lg:max-w-none lg:w-1/2 lg:right-1/2
        lg:px-40

        max-w-[700px]
      "
      >
        {/* Page heading */}
        <header
          dir="ltr"
          className="
          flex w-full items-center justify-end gap-8
        "
        >
          <h1
            dir="rtl"
            className="
            text-18 font-medium text-neutral-8
            md:text-22
            lg:text-26 lg:font-semibold
          "
          >
            ورود
          </h1>

          <LogInIcon
            className="
            size-24 shrink-0 text-neutral-8
            lg:size-28
          "
          />
        </header>
        <LoginForm />
      </section>
    </main>
  );
}
