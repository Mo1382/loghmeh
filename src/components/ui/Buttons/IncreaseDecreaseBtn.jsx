import Plus from "@/components/icons/Plus";
import Minus from "@/components/icons/Minus";

const baseClassName =
  "inline-flex items-center justify-center rounded-[10px] md:rounded-2xl bg-red-500 text-white transition-colors hover:bg-red-hover";

const iconClassName =
  "text-neutral-1 stroke-[3px] w-16 h-16 md:w-28 md:h-28 lg:w-[31px] lg:h-[31px]";

export default function IncreaseDecreaseBtn({ type = "increase", onClick }) {
  const isIncrease = type === "increase";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClassName} w-34 h-34 md:w-52 md:h-52 lg:w-58 lg:h-58`}
    >
      {isIncrease ? (
        <Plus className={iconClassName} />
      ) : (
        <Minus className={iconClassName} />
      )}
    </button>
  );
}
