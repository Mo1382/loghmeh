import Trash from "@/components/icons/Trash";

const baseClassName =
  "inline-flex items-center justify-center border border-red-400 bg-neutral-1 text-red-400 transition-colors hover:border-red-hover hover:text-red-hover";

const ingredientClassName = "p-[11px] rounded-xl lg:p-12";
const ingredientIconClassName =
  "h-22 w-22 stroke-[1px] md:h-22 md:w-22 lg:h-24 lg:w-24 lg:stroke-[1.5px]";

const stepClassName = "p-8 rounded-[10px] md:p-[11px] md:rounded-xl lg:p-14";
const stepIconClassName =
  "h-16 w-16 stroke-[1px] md:h-22 md:w-22 lg:h-24 lg:w-24 lg:stroke-[1.5px]";

const notificationClassName =
  "rounded-lg p-[7px] md:p-14 md:rounded-xl lg:p-16";
const notificationIconClassName =
  "h-18 w-18 stroke-[1px] md:h-24 md:w-24 lg:h-26 lg:w-26 lg:stroke-[1.5px]";

export default function RemoveItemBtn({ type = "notification" }) {
  let buttonClassName;
  let iconClassName;

  if (type === "notification") {
    buttonClassName = notificationClassName;
    iconClassName = notificationIconClassName;
  }

  if (type === "ingredient") {
    buttonClassName = ingredientClassName;
    iconClassName = ingredientIconClassName;
  }

  if (type === "step") {
    buttonClassName = stepClassName;
    iconClassName = stepIconClassName;
  }

  return (
    <button type="button" className={`${baseClassName} ${buttonClassName}`}>
      <Trash className={iconClassName} />
    </button>
  );
}
