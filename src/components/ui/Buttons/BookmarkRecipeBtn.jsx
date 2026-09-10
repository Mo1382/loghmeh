import BookmarkOutline from "@/components/icons/BookmarkOutline";

const iconClassName = "h-[17px] w-[17px] stroke-[2.5px] lg:h-20 lg:w-20";

const buttonClassName =
  "inline-flex items-center justify-center gap-x-[5px] rounded-md bg-red-500 py-[9px] pr-10 pl-14 text-14 font-medium text-neutral-1 transition-colors hover:bg-red-hover lg:gap-x-6 lg:py-[11px] lg:pr-12 lg:pl-16 lg:text-16";

export default function BookmarkRecipeBtn() {
  return (
    <button type="button" className={buttonClassName}>
      <BookmarkOutline className={iconClassName} />
      <span>ذخیره</span>
    </button>
  );
}
