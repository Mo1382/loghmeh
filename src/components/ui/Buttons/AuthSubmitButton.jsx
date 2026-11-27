import CheckboxChecked from "@/components/icons/CheckboxChecked";
import ButtonSpinner from "@/components/shared/ButtonSpinner";

const buttonClassName = `
  relative isolate inline-flex h-[44px] w-fit shrink-0
  items-center justify-center whitespace-nowrap
  rounded-[10px] bg-red-500
  py-12 pr-8 pl-16
  text-15 font-medium text-neutral-1
  transition-colors
  hover:bg-red-hover
  focus-visible:outline-2 focus-visible:outline-offset-2
  focus-visible:outline-red-500
  disabled:cursor-not-allowed disabled:opacity-60

  md:h-[46px] md:rounded-lg
  md:py-[11px] md:pr-12 md:text-16

  lg:h-[52px]
  lg:py-12 lg:pr-14 lg:pl-20
  lg:text-19
`;

const contentClassName = `
  inline-flex items-center gap-x-[7px]
  lg:gap-x-10
`;

const iconClassName = `
  h-20 w-20 stroke-[1.5px]
  md:h-[21px] md:w-[21px] md:stroke-2
  lg:h-24 lg:w-24
`;

export default function AuthSubmitButton({
  label,
  loadingLabel,
  disabled = false,
  isLoading = false,
}) {
  return (
    <button
      type="submit"
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      aria-label={isLoading ? loadingLabel : undefined}
      className={buttonClassName}
    >
      <span
        aria-hidden="true"
        className={`
          ${contentClassName}
          ${isLoading ? "invisible" : ""}
        `}
      >
        <CheckboxChecked className={iconClassName} />

        <span>{label}</span>
      </span>

      {isLoading && <ButtonSpinner />}
    </button>
  );
}
