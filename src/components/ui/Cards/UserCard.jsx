import { StarIcon } from "@/components/icons";
import Image from "next/image";
import CardFollowUnfollowBtn from "../Buttons/CardFollowUnfollowBtn";
import SeeMoreBtn from "../Buttons/SeeMoreBtn";

export default function UserCard({ isInHome = false }) {
  const userRate = "4.5";
  const recipeName = "کیک بروانی شکلاتی";
  const userRole = "کاربر عادی";
  const userImg = "/img/avatar.png";
  const username = "Amir_82";
  const userRecipesNumber = 18;

  const isCurrentUserAuthenticated = true;
  const isUserFollowed = false;

  const wrapperClassName = `group flex flex-col cursor-pointer border border-neutral-5 hover:border-red-400 rounded-xl transition overflow-hidden bg-neutral-1 w-1/3 ${isInHome ? "w-[118px]" : ""} md:w-1/5 lg:w-1/3 lg:flex-row lg:rounded-card`;

  return (
    <div className={wrapperClassName}>
      <div className="relative w-full lg:w-[152px] aspect-square overflow-hidden rounded-t-xl rounded-b-[10px] lg:rounded-r-24 lg:rounded-l-20">
        <Image
          className="transition-transform duration-300 group-hover:scale-[1.1]"
          alt={username}
          src={userImg}
          fill
        />
        <span className="cursor-pointer absolute z-10 top-0 right-0">
          {isCurrentUserAuthenticated && isUserFollowed && (
            <CardFollowUnfollowBtn type="follow" />
          )}
          {isCurrentUserAuthenticated && !isUserFollowed && (
            <CardFollowUnfollowBtn type="unfollow" />
          )}
        </span>
      </div>
      <div className="pt-10 px-12 pb-16 lg:px-24 lg:py-16 lg:grow">
        <h4 className="text-14 font-medium text-neutral-8 mb-10 lg:text-20 lg:font-semibold lg:mb-4">
          {username}
        </h4>

        <div className="hidden lg:block text-12 font-light text-neutral-7 mb-20">
          {userRecipesNumber} دستور پخت
        </div>

        <div className="flex flex-row items-center justify-between mb-16 lg:mb-14">
          <h6 className="text-9 font-light text-neutral-7 lg:text-11">
            {userRole}
          </h6>
          {userRate && (
            <div className="flex flex-row-reverse items-center gap-x-6 lg:gap-x-[5px]">
              <StarIcon className="w-12 h-12 text-yellow-500 fill-yellow-500 lg:w-14 lg:h-14" />
              <span className="text-10 font-normal text-neutral-7 lg:text-11 lg:font-medium">
                {userRate}
              </span>
            </div>
          )}
        </div>
        <SeeMoreBtn iconClassNameUpdate="group-hover:-translate-x-8 md:group-hover:-translate-x-10 lg:group-hover:-translate-x-12 transition-transform duration-500" />
      </div>
    </div>
  );
}
