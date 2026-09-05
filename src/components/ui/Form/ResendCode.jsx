"use client";

import ResendCodeBtn from "@/components/ui/Buttons/ResendCodeBtn";

const timerClassName =
  "font-medium text-neutral-8 text-12 md:text-14 md:font-semibold lg:text-16";

const resendRowClassName =
  "flex w-fit items-center gap-x-[7px] text-right text-12 md:gap-x-8 md:text-14 lg:gap-x-10 lg:text-16";

export default function ResendCode({
  email = "mahdimms.expert999@gmail.com",
  timer = "01:34",
  name = "verify-code",
}) {
  return (
    <div className={resendRowClassName}>
      <ResendCodeBtn />
      <span className={timerClassName} dir="ltr">
        {timer}
      </span>
    </div>
  );
}
