import LogIn from "@/components/icons/LogIn";

const iconClassName =
  "h-18 w-18 md:h-20 md:w-20 lg:h-20 lg:w-20 stroke-[1.5px] lg:stroke-2";

export default function SignInSmallBtn({ type = "lg" }) {
  const isSmall = type === "sm";

  const className = `inline-flex items-center justify-center gap-x-6 rounded-md bg-red-500 py-10 pr-14 pl-16 text-14 font-semibold ${isSmall ? "font-medium lg:font-semibold pr-14 py-[9px] pl-16" : ""} text-neutral-1 transition-colors hover:bg-red-hover lg:gap-x-8 lg:py-[11px] lg:pr-14 lg:pl-16 lg:text-16`;

  return (
    <button type="button" className={className}>
      <LogIn className={iconClassName} />
      <span>ورود</span>
    </button>
  );
}
