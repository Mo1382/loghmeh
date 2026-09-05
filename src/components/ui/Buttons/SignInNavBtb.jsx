import LogInIcon from "@/components/icons/LogIn";

const className = "group inline-flex items-center md:gap-x-12 lg:gap-x-14";

const iconClassName =
  "h-24 w-24 md:h-26 md:w-26 lg:h-28 lg:w-28 text-neutral-9 group-hover:text-neutral-11 transition-colors";

export default function SignInNavBtn() {
  return (
    <button type="button" className={className}>
      <LogInIcon className={iconClassName} />
      <span className="hidden md:inline-block text-neutral-8 text-16 font-normal lg:text-17 group-hover:text-neutral-10 transition-colors">
        ورود
      </span>
    </button>
  );
}
