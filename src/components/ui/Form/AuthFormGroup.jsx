import FormErrorMessage from "../Auth/FormErrorMessage";

const inputClassName = `
  py-12 w-full text-right rounded-[10px]
  border border-neutral-5 bg-neutral-1
  px-14 text-14 font-normal text-neutral-8
  outline-none placeholder:text-neutral-6
  focus:border-red-400
  focus-visible:outline-2
  focus-visible:outline-offset-2
  focus-visible:outline-red-600
  md:rounded-xl md:px-16 md:text-15
  lg:text-16
`;

const labelClassName = `
  block mb-12 text-right
  text-15 font-medium text-neutral-8
  md:mb-14 md:text-16
`;

const fieldErrorClassName = `
  mt-[10px] h-[18px] font-normal
  md:mt-[12px] md:h-5
  lg:h-[21px]
`;

export default function AuthFormGroup({
  inputId,
  type = "text",
  label,
  placeholder,
  errorMsg,
  registration,
  autoComplete,
  dir = "auto",
  disabled = false,
  required = true,
  autoCapitalize,
  autoCorrect,
  spellCheck,
}) {
  const errorId = `${inputId}-error`;

  const normalizedErrorMsg =
    typeof errorMsg === "string" ? errorMsg.trim() : "";

  const hasError = Boolean(normalizedErrorMsg);

  return (
    <div className="w-full">
      <label className={labelClassName} htmlFor={inputId}>
        {label}
      </label>
      <input
        {...registration}
        id={inputId}
        type={type}
        dir={dir}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        aria-invalid={hasError}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        spellCheck={spellCheck}
        aria-describedby={hasError ? errorId : undefined}
        placeholder={placeholder}
        className={`${inputClassName} ${
          hasError ? "border-red-500 focus:border-red-500" : ""
        }`}
      />
      <FormErrorMessage
        id={errorId}
        message={normalizedErrorMsg}
        className={fieldErrorClassName}
      />
    </div>
  );
}
