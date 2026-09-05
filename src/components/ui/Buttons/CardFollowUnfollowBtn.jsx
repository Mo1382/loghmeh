import UserAdd from "@/components/icons/UserAdd";
import UserRemove from "@/components/icons/UserRemove";

const baseClassName =
  "inline-flex items-center justify-center text-white pr-[9px] py-10 pl-[11px] transition-colors rounded-md rounded-tr-xl lg:pr-12 lg:pt-12 lg:pl-14 lg:pm-10 lg:rounded-lg lg:rounded-tr-3xl";

const followClassName = "bg-red-500 hover:bg-red-hover";

const unfollowClassName = "bg-neutral-10 hover:bg-neutral-12";

const iconClassName = "h-20 w-20 stroke-[1.5px] lg:h-24 lg:w-24 lg:stroke-2";

export default function CardFollowUnfollowBtn({ type = "follow" }) {
  const isFollow = type === "follow";

  return (
    <button
      type="button"
      className={`${baseClassName} ${isFollow ? followClassName : unfollowClassName}`}
    >
      {isFollow ? (
        <UserAdd className={iconClassName} />
      ) : (
        <UserRemove className={iconClassName} />
      )}
    </button>
  );
}
