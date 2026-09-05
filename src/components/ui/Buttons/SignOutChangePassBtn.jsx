import Lock from "@/components/icons/Lock";
import LogOut from "@/components/icons/LogOut";

const iconClassName =
  "h-20 w-20 stroke-[1.5px] md:h-[21px] md:w-[21px] lg:h-24 lg:w-24 lg:stroke-2";

const buttonClassName =
  "inline-flex items-center gap-x-10 rounded-md border border-red-400 bg-neutral-1 py-12 pr-12 pl-14 text-14 font-medium text-red-400 transition-colors hover:border-red-hover hover:text-red-hover md:py-[11px] md:pr-12 md:pl-14 md:text-15 lg:gap-x-10 lg:rounded-[10px] lg:py-12 lg:pr-14 lg:pl-20 lg:text-19";

export default function SignOutChangePassBtn({ type = "signout" }) {
  const isSignOut = type === "signout";

  return (
    <button type="button" className={buttonClassName}>
      {isSignOut ? (
        <LogOut className={iconClassName} />
      ) : (
        <Lock className={iconClassName} />
      )}
      <span>{isSignOut ? "خروج از حساب کاربری" : "تغییر رمز عبور"}</span>
    </button>
  );
}
