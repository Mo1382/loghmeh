import Checkmark from "@/components/icons/Checkmark";
import Close from "@/components/icons/Close";
import Edit from "@/components/icons/Edit";
import PlusIcon from "@/components/icons/Plus";
import Trash from "@/components/icons/Trash";

const iconTypes = {
  remove: Trash,
  edit: Edit,
  close: Close,
  add: PlusIcon,
  submit: Checkmark,
};

export default function ProfileBtn({
  type = "remove",
  mediumSize = "sm",
  className = "",
  onClick,
}) {
  const Icon = iconTypes[type];
  const btnClassName =
    mediumSize === "lg"
      ? "rounded-lg border p-6 md:rounded-[10px] md:p-[7px]"
      : "rounded-lg border p-6 lg:rounded-[10px] lg:p-[7px]";
  const iconClassName =
    mediumSize === "lg"
      ? "h-16 w-16 stroke-[1.5px] md:h-20 md:w-20"
      : "h-16 w-16 stroke-[1.5px] lg:h-20 lg:w-20";

  const baseClassName =
    "inline-flex items-center bg-neutral-1 transition-colors border border-red-400 text-red-400 hover:text-red-hover hover:border-red-hover";

  return (
    <button
      type="button"
      className={`${baseClassName} ${btnClassName} ${className}`.trim()}
      onClick={onClick}
    >
      <Icon className={iconClassName} />
    </button>
  );
}
