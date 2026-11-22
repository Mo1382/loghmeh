const inputClassName = `
  py-12 w-full text-right rounded-[10px]
  border border-neutral-5 bg-neutral-1
  px-14 text-14 font-normal text-neutral-8
  outline-none placeholder:text-neutral-6
  focus:border-red-400
  md:rounded-xl md:px-16 md:text-15
  lg:text-16
`;

const labelClassName = `
  block mb-12 text-right
  text-15 font-medium text-neutral-8
  md:mb-14 md:text-16
`;

const errorClassName = `
  mt-[10px] block h-[18px] w-full truncate
  text-right text-12 font-normal leading-[18px] text-red-500

  md:mt-[12px] md:h-5 md:text-13 md:leading-5
  lg:h-[21px] lg:text-14 lg:leading-[21px]
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
}) {
  const errorId = `${inputId}-error`;

  const hasError = Boolean(errorMsg);

  const handleChange = (event) => {
    registration?.onChange?.(event);
    onChange?.(event);
  };

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
        aria-describedby={hasError ? errorId : undefined}
        placeholder={placeholder}
        className={`${inputClassName} ${
          hasError ? "border-red-500 focus:border-red-500" : ""
        }`}
      />
      {hasError && errorMsg ? (
        <span
          id={errorId}
          role="alert"
          title={errorMsg}
          className={errorClassName}
        >
          {errorMsg}
        </span>
      ) : null}
    </div>
  );
}
