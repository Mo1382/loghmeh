const inputClassName =
  "py-12 w-full rounded-[10px] border border-neutral-5 bg-neutral-1 px-14 text-14 font-normal text-neutral-8 outline-none placeholder:text-neutral-6 focus:border-red-400 md:rounded-xl  md:text-15 lg:text-16 lg:px-16";

const labelClassName =
  "block mb-10 text-right text-15 font-medium text-neutral-8 md:mb-12 lg:text-16 lg:mb-14";

const errorClassName =
  "mt-10 block text-right pr-4 text-12 font-normal text-red-500 md:pr-0 md:text-13 lg:mt-12 lg:text-14";

export default function RecipeFormGroup({
  inputId,
  label,
  placeholder,
  errorMsg = "پر کردن این فیلد الزامی است.",
}) {
  const isError = false;

  return (
    <div className="w-full">
      <label className={labelClassName} htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={`${inputClassName} ${isError ? "border-red-500" : ""}`}
        placeholder={placeholder}
      />
      {isError ? <span className={errorClassName}>{errorMsg}</span> : null}
    </div>
  );
}
