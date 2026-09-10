import { BookmarkOutlineIcon } from "../icons";
import BookmarkRecipeBtn from "../ui/Buttons/BookmarkRecipeBtn";

export default function BookmarkRecipe() {
  return (
    <div className="flex flex-col items-center">
      <BookmarkOutlineIcon className="mb-[15px] lg:mb-20 w-[100px] h-[100px] lg:w-[115px] lg:h-[115px] text-neutral-5 stroke-[1.5px]" />
      <p className="text-11 lg:text-14 font-light lg:font-regular text-neutral-8 max-w-[240px] lg:max-w-[280px] mb-24 leading-[186%] text-center lg:mb-28">
        با ذخیره‌ی این دستور پخت، به راحتی در آینده به آن دسترسی داشته باشید.
      </p>
      <BookmarkRecipeBtn />
    </div>
  );
}
