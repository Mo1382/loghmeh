"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";

import { ERROR_CODES } from "@/constants/error-codes";

import { loginAction } from "@/app/actions/auth/login";
import { loginUserSchema } from "@/validations/auth.validation";

import SignInBtn from "../Buttons/SignInBtn";
import AuthFormGroup from "./AuthFormGroup";
import FormFooter from "./FormFooter";

const PERSISTENT_ROOT_ERROR_CODES = new Set([
  ERROR_CODES.RATE_LIMIT_EXCEEDED,
  ERROR_CODES.RATE_LIMIT_UNAVAILABLE,
]);

function getFirstErrorMessage(messages) {
  if (Array.isArray(messages)) {
    return (
      messages.find(
        (message) => typeof message === "string" && message.trim().length > 0
      ) ?? ""
    );
  }

  return typeof messages === "string" ? messages : "";
}

export default function LoginForm() {
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    getFieldState,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginUserSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  // Clear non-persistent server errors when the user changes a field.
  function clearRootErrorOnFieldChange() {
    const errorType = getFieldState("root.server").error?.type;

    if (!PERSISTENT_ROOT_ERROR_CODES.has(errorType)) {
      clearErrors("root.server");
    }
  }

  async function onSubmit(values) {
    // Clear previous server errors before a new valid submission.
    clearErrors(["identifier", "password", "root.server"]);

    const formData = new FormData();

    formData.set("identifier", values.identifier);
    formData.set("password", values.password);

    try {
      const response = await loginAction(formData);

      const serverError = response.error;
      const serverFieldErrors = serverError?.fieldErrors ?? {};

      let hasFieldErrors = false;

      // Map server-side field errors to React Hook Form.
      for (const field of ["identifier", "password"]) {
        const message = getFirstErrorMessage(serverFieldErrors[field]);

        if (message) {
          setError(field, {
            type: "server",
            message,
          });

          hasFieldErrors = true;
        }
      }

      // Show a general server error only when no field error exists.
      if (!hasFieldErrors) {
        const serverFormError = getFirstErrorMessage(serverError?.formErrors);

        setError("root.server", {
          type: serverError?.code ?? "server",
          message:
            serverFormError ||
            serverError?.message ||
            "ورود با مشکل مواجه شد. لطفاً دوباره تلاش کنید.",
        });
      }
    } catch {
      setError("root.server", {
        type: "server",
        message: "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.",
      });
    }
  }

  const identifierRegistration = register("identifier", {
    onChange: clearRootErrorOnFieldChange,
  });

  const passwordRegistration = register("password", {
    onChange: clearRootErrorOnFieldChange,
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      aria-labelledby="login-heading"
      className="
        mt-[22px] flex h-[476px] w-full shrink-0
        flex-col rounded-[16px] border border-neutral-4
        bg-neutral-1 px-[15px] pb-30 pt-[23px]
        shadow-card

        md:mt-[27px] md:h-[519px]
        md:rounded-[24px] md:px-[31px]
        md:pb-[35px] md:pt-[35px]

        lg:mt-32 lg:h-[548px]
        lg:max-w-none lg:px-[37px]
        lg:pb-[33px] lg:pt-[37px]
      "
    >
      {/* Input fields */}
      <div className="flex w-full shrink-0 flex-col gap-y-12 md:gap-y-14">
        <AuthFormGroup
          inputId="login-identifier"
          label="نام کاربری یا ایمیل"
          placeholder="نام کاربری یا آدرس پست الکترونیکی خود را وارد نمایید"
          registration={identifierRegistration}
          type="text"
          autoComplete="username"
          errorMsg={errors.identifier?.message}
          disabled={isSubmitting}
        />

        <AuthFormGroup
          inputId="login-password"
          label="رمز عبور"
          placeholder="رمز عبور خود را وارد نمایید"
          registration={passwordRegistration}
          type="password"
          autoComplete="current-password"
          dir="ltr"
          errorMsg={errors.password?.message}
          disabled={isSubmitting}
        />
      </div>

      {/* General server error — reserved space */}
      <div
        className="
          mt-12 h-[18px] w-full shrink-0
          md:h-5
          lg:h-[21px]
        "
      >
        {errors.root?.server?.message ? (
          <p
            role="alert"
            title={errors.root.server.message}
            className="
              h-full w-full truncate text-right
              text-12 leading-[18px] text-red-500
              md:text-13 md:leading-5
              lg:text-14 lg:leading-[21px]
            "
          >
            {errors.root.server.message}
          </p>
        ) : null}
      </div>

      {/* Authentication links */}
      <div
        className="
          mt-24 flex w-full shrink-0 flex-col gap-y-10
          text-right
          md:mt-[27px] md:gap-y-12
          lg:mt-[21px]
        "
      >
        <FormFooter>
          رمزتان را فراموش کرده‌اید؟{" "}
          <Link href="/forgot-password">بازیابی رمز</Link>
        </FormFooter>

        <FormFooter>
          هنوز عضو نشده‌اید؟ <Link href="/register">ثبت نام</Link>
        </FormFooter>
      </div>

      {/* Submit button */}
      <div
        className="
          mt-auto shrink-0
          pt-36
          md:pt-40
          lg:pt-[56px]
        "
      >
        <SignInBtn isLoading={isSubmitting} />
      </div>
    </form>
  );
}
