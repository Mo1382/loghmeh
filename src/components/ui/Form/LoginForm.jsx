"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { CheckboxCheckedIcon, LogInIcon } from "@/components/icons";
import AuthFormGroup from "./AuthFormGroup";
import ButtonSpinner from "@/components/shared/ButtonSpinner";

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

    // Use Zod-normalized values returned by the resolver.
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

      // Map general server-side errors.
      const serverFormError = getFirstErrorMessage(response.error?.formErrors);

      if (serverFormError) {
        setError("root.server", {
          type: "server",
          message: serverFormError,
        });
      } else if (!hasFieldErrors) {
        setError("root.server", {
          type: "server",
          message:
            response.error?.message ??
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
       relative flex min-h-dvh w-full flex-col items-center justify-center
        bg-neutral-2 

 md:max-w-[578px]

        lg:max-w-none lg:w-1/2 lg:right-1/2 lg:px-40 max-w-[700px]
      "
    >
      {/* Page heading */}
      <header
        dir="ltr"
        className="
          flex w-full
          items-center justify-end gap-8
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
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        aria-label="فرم ورود"
        className="
          mt-[22px] flex w-full
          flex-col rounded-[16px] border border-neutral-4
          bg-neutral-1 px-[15px] pb-30 pt-[23px]
          shadow-card

          md:mt-[27px]
          md:rounded-[24px] md:px-[31px]
          md:pb-[35px] md:pt-[35px]

          lg:mt-32 
          lg:max-w-none lg:px-[37px]
          lg:pb-[33px] lg:pt-[37px]
        "
      >
        {/* Input fields */}
        <div
          className="
            flex w-full flex-col gap-y-20
            md:gap-y-24
            lg:gap-y-[22px]
          "
        >
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

        {/* General server error */}
        {errors.root?.server?.message ? (
          <p
            role="alert"
            className="
              mt-12 w-full text-right text-12
              text-red-500
              md:text-13
              lg:text-14
            "
          >
            {errors.root.server.message}
          </p>
        ) : null}

        {/* Authentication links */}
        <div
          className="
            mt-24 flex w-full flex-col gap-y-10
            text-right

            md:mt-[27px] md:gap-y-12

            lg:mt-[21px]
          "
        >
          <FormFooter>
            رمزتان را فراموش کرده‌اید؟{" "}
            <Link
              href="/forgot-password"
              className="text-red-500 transition-colors hover:text-red-hover"
            >
              بازیابی رمز
            </Link>
          </FormFooter>

          <FormFooter>
            هنوز عضو نشده‌اید؟{" "}
            <Link
              href="/register"
              className="text-red-500 transition-colors hover:text-red-hover"
            >
              ثبت نام
            </Link>
          </FormFooter>
        </div>

        {/* Submit button */}
        <div className="mt-36 md:mt-40 lg:mt-[56px]">
          <SignInBtn disabled={isSubmitting} isLoading={isSubmitting} />
        </div>
      </form>
    </section>
  );
}
