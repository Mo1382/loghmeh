"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { LogInIcon } from "@/components/icons";
import AuthFormGroup from "./AuthFormGroup";

import { loginAction } from "@/app/actions/auth/login";
import { loginUserSchema } from "@/validations/auth.validation";
import SignInBtn from "../Buttons/SignInBtn";
import FormFooter from "./FormFooter";

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
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
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

  async function onSubmit(values) {
    clearErrors("root.server");

    const formData = new FormData();

    formData.set("identifier", values.identifier);
    formData.set("password", values.password);

    try {
      const response = await loginAction(formData);

      if (response.success) {
        router.replace("/");
        return;
      }

      const serverFieldErrors = response.error?.fieldErrors ?? {};

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
        const serverFormError = getFirstErrorMessage(
          response.error?.formErrors
        );

        setError("root.server", {
          type: "server",
          message:
            serverFormError ||
            response.error?.message ||
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
    onChange: () => clearErrors("root.server"),
  });

  const passwordRegistration = register("password", {
    onChange: () => clearErrors("root.server"),
  });

  return (
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

      {/* Login form */}
      <form
        dir="rtl"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        aria-label="فرم ورود"
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
            isError={Boolean(errors.identifier)}
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
            isError={Boolean(errors.password)}
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
          aria-live="polite"
          aria-atomic="true"
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
    </section>
  );
}
