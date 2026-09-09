import { BookmarkOutlineIcon, StarIcon } from "@/components/icons";
import Image from "next/image";
import SeeMoreBtn from "../Buttons/SeeMoreBtn";
import ProfileBtn from "../Buttons/ProfileBtn";

export default function RecipeCard({
  isBookmarked = false,
  isInHome = false,
  isInProfile = false,
}) {
  const recipeRate = "4.5";
  const recipeImg = "/img/chocolate-cake-with-chocolate-drops-cream.png";
  const recipeName = "کیک بروانی شکلاتی";
  const recipeCategory = "دسر";
  const userImg = "/img/test-avatar.png";
  const username = "Sara_953";

  const wrapperClassName =
    "w-full group cursor-pointer bg-neutral-1 rounded-card-sm  border border-neutral-5 hover:border-red-400 transition overflow-hidden lg:rounded-card";

  return (
    <div
      className={`relative shrink-0 basis-1/2 ${isInHome ? "basis-[154px]" : ""} md:basis-[calc((100%_-_72px)_/_4)] lg:basis-[calc((100%_-_96px)_/_4)]`}
    >
      <div className={wrapperClassName}>
        <div className="relative w-full aspect-square overflow-hidden rounded-t-card-sm rounded-b-[14px] rounded-t-card rounded-b-[20px]">
          <Image
            className="transition-transform duration-300 group-hover:scale-[1.1]"
            alt={recipeName}
            src={recipeImg}
            fill
          />
          <span className="cursor-pointer absolute z-10 top-12 right-12 lg:right-16 lg:top-16">
            <BookmarkOutlineIcon
              className={`w-28 h-28 lg:w-32 lg:h-32 stroke-2 text-neutral-1  ${isBookmarked ? "text-red-400 fill-red-400" : ""}`}
            />
          </span>
        </div>
        <div className="pt-14 px-16 pb-20 lg:px-24 lg:pt-20 lg:pb-24">
          <h4 className="text-14 font-semibold text-neutral-8 mb-10 lg:text-18 lg:mb-6">
            {recipeName}
          </h4>
          <h6 className="text-11 font-light mb-12 text-neutral-7 lg:text-13 lg:mb-4">
            {recipeCategory}
          </h6>
          <div className="flex flex-row-reverse items-center justify-between mb-16 lg:mb-12">
            <div className="relative w-30 h-30 lg:w-[44px] lg:h-[44px]">
              <Image src={userImg} fill alt={username} />
            </div>
            {/* <SeeMoreBtn className="md:hidden!" /> */}
            {recipeRate && (
              <div className="flex flex-row-reverse items-center gap-x-6 lg:gap-x-6">
                <StarIcon className="w-12 h-12 text-yellow-500 fill-yellow-500 lg:w-14 lg:h-14" />
                <span className="text-10 font-normal text-neutral-7 lg:text-12 lg:font-medium">
                  {recipeRate}
                </span>
              </div>
            )}
          </div>
          {/* <SeeMoreBtn className="hidden! md:inline-flex!" /> */}
          <SeeMoreBtn iconClassNameUpdate="group-hover:-translate-x-8 md:group-hover:-translate-x-10 lg:group-hover:-translate-x-12 transition-transform duration-500" />
        </div>
      </div>
      {isInProfile && (
        <div className="flex flex-row absolute -bottom-[15px] left-12 gap-x-6 lg:left-16 lg:-bottom-12 lg:gap-x-8">
          <ProfileBtn type="edit" mediumSize="sm" />
          <ProfileBtn type="remove" mediumSize="sm" />
        </div>
      )}
    </div>
  );
}
