import CheckboxChecked from "@/components/icons/CheckboxChecked";
import ButtonSpinner from "@/components/shared/ButtonSpinner";

const className = `
  inline-flex h-[44px] w-[102px] items-center justify-center
  gap-x-[7px] rounded-[10px] bg-red-500
  text-15 font-medium text-neutral-1 transition-colors
  hover:bg-red-hover
  focus-visible:outline-2 focus-visible:outline-offset-2
  focus-visible:outline-red-500
  disabled:cursor-not-allowed disabled:opacity-60

  md:h-[46px] md:w-[106px]
  md:rounded-lg md:text-16

  lg:h-[52px] lg:w-[102px]
  lg:gap-x-10 lg:py-12 lg:pr-14 lg:pl-20 lg:text-19
`;

const iconClassName = `
  h-20 w-20 stroke-2
  md:h-[21px] md:w-[21px]
  lg:h-24 lg:w-24
`;

export default function SignInBtn({ disabled = false, isLoading = false }) {
  return (
    <button
      type="submit"
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={className}
    >
      {isLoading ? (
        <>
          <ButtonSpinner />
        </>
      ) : (
        <>
          <CheckboxChecked className={iconClassName} />
          <span>ورود</span>
        </>
      )}
    </button>
  );
}
