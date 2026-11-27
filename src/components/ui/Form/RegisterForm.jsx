"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";

import { USER_TITLES } from "@/constants/enums";
import { ERROR_CODES } from "@/constants/error-codes";

import { registerAction } from "@/app/actions/auth/register";
import { registerUserSchema } from "@/validations/auth.validation";

import FormErrorMessage from "../Auth/FormErrorMessage";
import AuthSubmitButton from "../Buttons/AuthSubmitButton";
import AuthFormGroup from "./AuthFormGroup";
import FormFooter from "./FormFooter";

import SelectDropdown from "@/components/ui/Select/SelectDropdown";

/*
 * ============================================================================
 * Constants
 * ============================================================================
 */

// Keep the options aligned with the current Figma dropdown.
const TITLE_OPTIONS = [
  {
    value: USER_TITLES.USER,
    label: "کاربر",
  },
  {
    value: USER_TITLES.BARISTA,
    label: "باریستا",
  },
  {
    value: USER_TITLES.COOK,
    label: "آشپز",
  },
  {
    value: USER_TITLES.HEAD_CHEF,
    label: "سر آشپز",
  },
  {
    value: USER_TITLES.FOOD_BLOGGER,
    label: "بلاگر غذا",
  },
];

const FORM_FIELDS = ["username", "email", "password", "title"];

const PERSISTENT_ROOT_ERROR_CODES = new Set([
  ERROR_CODES.RATE_LIMIT_UNAVAILABLE,
]);

/*
 * ============================================================================
 * Helpers
 * ============================================================================
 */

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

/*
 * ============================================================================
 * Register Form
 * ============================================================================
 */

export default function RegisterForm() {
  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    getFieldState,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerUserSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      username: "",
      email: "",
      password: "",
      title: USER_TITLES.USER,
    },
  });

  /*
   * --------------------------------------------------------------------------
   * Root Error Handling
   * --------------------------------------------------------------------------
   */

  function clearRootErrorOnFieldChange() {
    const errorType = getFieldState("root.server").error?.type;

    if (!PERSISTENT_ROOT_ERROR_CODES.has(errorType)) {
      clearErrors("root.server");
    }
  }

  /*
   * --------------------------------------------------------------------------
   * Form Submission
   * --------------------------------------------------------------------------
   */

  async function onSubmit(values) {
    // Clear previous server errors before a new valid submission.
    clearErrors([...FORM_FIELDS, "root.server"]);

    const formData = new FormData();

    formData.set("username", values.username);
    formData.set("email", values.email);
    formData.set("password", values.password);
    formData.set("title", values.title);

    try {
      const response = await registerAction(formData);

      const serverError = response?.error;
      const serverFieldErrors = serverError?.fieldErrors ?? {};

      // A successful registration is handled by the Action redirect.
      if (!serverError) {
        return;
      }

      let hasFieldErrors = false;

      // Map server-side field errors to React Hook Form.
      for (const field of FORM_FIELDS) {
        const message = getFirstErrorMessage(serverFieldErrors[field]);

        if (message) {
          setError(field, {
            type: "server",
            message,
          });

          hasFieldErrors = true;
        }
      }

      if (!hasFieldErrors) {
        const serverFormError = getFirstErrorMessage(serverError.formErrors);

        const baseMessage =
          serverFormError ||
          serverError.message ||
          "ثبت‌نام با مشکل مواجه شد. لطفاً دوباره تلاش کنید.";

        const retryAfter =
          serverError.code === ERROR_CODES.RATE_LIMIT_EXCEEDED &&
          Number.isSafeInteger(serverError.retryAfter) &&
          serverError.retryAfter > 0
            ? serverError.retryAfter
            : null;

        const message =
          retryAfter !== null
            ? `لطفاً ${retryAfter.toLocaleString("fa-IR")} ثانیه دیگر تلاش کنید.`
            : baseMessage;

        setError("root.server", {
          type: serverError.code ?? "server",
          message,
        });
      }
    } catch {
      setError("root.server", {
        type: "server",
        message: "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.",
      });
    }
  }

  /*
   * --------------------------------------------------------------------------
   * Field Registration
   * --------------------------------------------------------------------------
   */

  const usernameRegistration = register("username", {
    onChange: clearRootErrorOnFieldChange,
  });

  const emailRegistration = register("email", {
    onChange: clearRootErrorOnFieldChange,
  });

  const passwordRegistration = register("password", {
    onChange: clearRootErrorOnFieldChange,
  });

  /*
   * --------------------------------------------------------------------------
   * Render
   * --------------------------------------------------------------------------
   */

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      aria-labelledby="register-heading"
      className="
        relative mt-[22px] flex min-h-[560px] w-full
        shrink-0 flex-col
        rounded-[16px] border border-neutral-4
        bg-neutral-1 px-[15px] pb-[30px] pt-[23px]
        shadow-card

        md:mt-[27px] md:min-h-[531px]
        md:rounded-[24px] md:px-[31px]
        md:pb-[35px] md:pt-[35px]

        lg:mt-32 lg:min-h-[552px]
        lg:px-[37px] lg:pb-[33px] lg:pt-[37px]
      "
    >
      {/* ------------------------------------------------------------------ */}
      {/* Input Fields */}
      {/* ------------------------------------------------------------------ */}

      <div
        className="
          flex w-full shrink-0 flex-col
          gap-y-12
          md:gap-y-14
          lg:gap-y-[22px]
        "
      >
        {/* Username and User Title */}

        <div
          dir="rtl"
          className="
            grid w-full grid-cols-1
            gap-y-12
            md:grid-cols-2 md:gap-x-32 md:gap-y-0
            lg:gap-x-[50px]
          "
        >
          <AuthFormGroup
            inputId="register-username"
            label="نام کاربری"
            placeholder="مثل محمد_82"
            registration={usernameRegistration}
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            errorMsg={errors.username?.message}
            disabled={isSubmitting}
          />

          {/* User Title */}
          <Controller
            control={control}
            name="title"
            render={({ field, fieldState }) => (
              <SelectDropdown
                ref={field.ref}
                id="register-title"
                label="عنوان کاربر"
                options={TITLE_OPTIONS}
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  clearRootErrorOnFieldChange();
                }}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                disabled={isSubmitting}
              />
            )}
          />
        </div>

        {/* Email */}

        <AuthFormGroup
          inputId="register-email"
          label="ایمیل"
          placeholder="آدرس پست الکترونیکی خود را وارد نمایید"
          registration={emailRegistration}
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          dir="ltr"
          errorMsg={errors.email?.message}
          disabled={isSubmitting}
        />

        {/* Password */}

        <AuthFormGroup
          inputId="register-password"
          label="رمز عبور"
          placeholder="رمز عبور خود را وارد نمایید"
          registration={passwordRegistration}
          type="password"
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          dir="ltr"
          errorMsg={errors.password?.message}
          disabled={isSubmitting}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* General Server Error */}
      {/* ------------------------------------------------------------------ */}

      {errors.root?.server?.message ? (
        <div className="mt-12 w-full shrink-0">
          <FormErrorMessage message={errors.root.server.message} />
        </div>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Terms and Authentication Links */}
      {/* ------------------------------------------------------------------ */}

      <div
        className="
          mt-24 flex w-full shrink-0 flex-col
          gap-y-10 text-right

          md:mt-[27px] md:gap-y-12

          lg:mt-[22px]
        "
      >
        <FormFooter>
          ثبت‌نام شما به معنای پذیرفتن کلیه{" "}
          <Link href="/terms">شرایط و ضوابط</Link> لقمه است.
        </FormFooter>

        <FormFooter>
          قبلاً ثبت‌نام کرده‌اید؟ <Link href="/login">وارد شوید</Link>
        </FormFooter>
      </div>

      {/* Submit Button */}
      <div
        className="
    mt-auto shrink-0 pt-36
    md:pt-40
    lg:pt-[56px]
  "
      >
        <AuthSubmitButton
          label="ثبت نام"
          loadingLabel="در حال ثبت‌نام"
          isLoading={isSubmitting}
        />
      </div>
    </form>
  );
}
