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
  name = inputId,
  type = "text",
  label = "ایمیل",
  placeholder = "آدرس پست الکترونیکی خود را وارد نمایید",
  errorMsg,
  isError = false,
  registration,
  autoComplete,
  dir = "auto",
  onChange,
  disabled = false,
  required = true,
}) {
  const errorId = `${inputId}-error`;

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
        ref={registration?.ref}
        name={registration?.name ?? name}
        id={inputId}
        type={type}
        dir={dir}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        aria-invalid={isError}
        aria-describedby={isError && errorMsg ? errorId : undefined}
        onChange={handleChange}
        onBlur={registration?.onBlur}
        placeholder={placeholder}
        className={`${inputClassName} ${
          isError ? "border-red-500 focus:border-red-500" : ""
        }`}
      />
      {isError && errorMsg ? (
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
