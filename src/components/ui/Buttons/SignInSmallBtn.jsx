import LogIn from "@/components/icons/LogIn";

const iconClassName = "h-18 w-18 md:h-20 md:w-20 lg:h-20 lg:w-20";

const className =
  "inline-flex items-center justify-center gap-x-6 rounded-md bg-red-500 py-10 pr-12 pl-14 text-14 font-semibold text-neutral-1 transition-colors hover:bg-red-hover lg:gap-x-8 lg:py-[11px] lg:pr-14 lg:pl-16 lg:text-16";

export default function SignInSmallBtn() {
  return (
    <button type="button" className={className}>
      <LogIn className={iconClassName} />
      <span>ورود</span>
    </button>
  );
}
