"use client";

import { useState } from "react";
import OtpInput from "react-otp-input";

const labelClassName =
  "mb-14 block text-right text-15 font-medium text-neutral-8 md:mb-16 md:text-17 lg:text-18";

const inputClassName =
  "w-[42px] h-[42px] rounded-[10px] border border-neutral-5 bg-neutral-1 text-center text-18 font-regular text-neutral-8 outline-none transition-colors focus:border-red-400 md:h-[64px] md:w-[64px] md:rounded-xl md:text-25 lg:h-[73px] lg:w-[73px] lg:text-28 lg:font-medium";

const errorClassName =
  "mt-14 block text-right text-12 font-normal text-red-500 md:mt-16 md:text-13 lg:text-14";

const containerClassName =
  "flex w-fit flex-row-reverse gap-14 md:gap-20 lg:gap-24";

export default function VerifyCode({
  name = "verify-code",
  errorMsg = "کد وارد شده صحیح نیست.",
}) {
  const isError = false; // Replace with your error state logic
  const [otp, setOtp] = useState("");

  return (
    <fieldset className="w-full border-0 p-0">
      <legend className={labelClassName}>کد ارسالی</legend>
      <OtpInput
        value={otp}
        onChange={setOtp}
        numInputs={6}
        inputType="tel"
        shouldAutoFocus
        containerStyle={containerClassName}
        inputStyle={`${inputClassName} ${isError ? "border-red-400" : ""}`}
        renderInput={(props, index) => (
          <input
            {...props}
            style={{ width: "undefined" }}
            name={`${name}-${index + 1}`}
          />
        )}
      />
      {isError ? <span className={errorClassName}>{errorMsg}</span> : null}
    </fieldset>
  );
}
