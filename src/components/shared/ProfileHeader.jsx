import { StarIcon } from "../icons";
import Avatar from "../ui/Avatar";
import FollowBtn from "../ui/Buttons/FollowBtn";
import ProfileBtn from "../ui/Buttons/ProfileBtn";

function formatCount(number) {
  if (number >= 1000) {
    const value = number / 1000;
    return `${Number(value.toFixed(1))}K`;
  }

  return number;
}

const userStatsItems = [
  {
    id: "recipesNum",
    label: "دستور پخت",
  },
  {
    id: "followersNum",
    label: "دنبال کننده",
  },
  {
    id: "followingsNum",
    label: "دنبال شونده",
  },
];

function UserStat({ label, value }) {
  return (
    <li className="flex flex-col gap-y-[1px] md:gap-y-4 lg:gap-y-6 items-center text-neutral-7">
      <span className="text-13 font-regular md:text-15 md:font-medium lg:text-18">
        {formatCount(value)}
      </span>
      <span className="text-11 font-light md:text-13 md:font-medium lg:text-15">
        {label}
      </span>
    </li>
  );
}

// export default function ProfileHeader({ type = "currentUser", user }) {
export default function ProfileHeader({ type = "currentUser" }) {
  // Fake data
  const user = {
    username: "Mohammad_chef",
    email: "Mohammad_Moradi8090@gmail.com",
    title: "آشپز",
    rate: 4.2,
    avatar: "/img/avatar.png",
    // avatar: "",
    stats: {
      recipesNum: 5,
      followersNum: 24,
      followingsNum: 13,
    },
  };

  const isCurrentUser = type === "currentUser";

  return (
    <>
      {/* Profile Header in mobile screen */}
      <div className="flex md:hidden w-full justify-between items-center">
        <div
          className={`flex flex-col ${isCurrentUser ? "gap-y-30" : "gap-y-10"} items-start`}
        >
          <div className="relative">
            <Avatar
              src={user.avatar || "/img/default-profile.png"}
              className="w-[62px] h-[62px] "
            />
            {isCurrentUser && (
              <div className="absolute -bottom-20 left-0 right-0 flex flex-row justify-between">
                {user.avatar ? (
                  <>
                    <ProfileBtn type="edit" mediumSize="sm" />
                    <ProfileBtn type="remove" mediumSize="sm" />
                  </>
                ) : (
                  <ProfileBtn type="add" mediumSize="sm" />
                )}
              </div>
            )}
          </div>

          <div className="relative flex flex-row items-end gap-x-12 text-15 font-medium text-neutral-7">
            {user.username}
            {!isCurrentUser && (
              // 98 = ~84px (button width) + 14px (gap between username and button)
              <div className="absolute -left-[98px] bottom-0">
                <FollowBtn type="sm" />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end">
          <ul
            className={`flex flex-row gap-x-14 ${isCurrentUser ? "mb-20" : "mb-24"}`}
          >
            {userStatsItems.map((item) => {
              return (
                <UserStat
                  key={item.id}
                  label={item.label}
                  value={user.stats[item.id]}
                />
              );
            })}
          </ul>

          {isCurrentUser && (
            <p className="text-10 font-light text-neutral-7 mb-20">
              {user.email}
            </p>
          )}

          <div className="flex flex-row-reverse gap-x-20 items-center gap-x-20">
            <div className="flex flex-row-reverse items-center gap-x-4">
              <StarIcon
                className="w-14 h-14 text-yellow-400 rounded-full"
                filled={true}
              />
              <span className="text-10 font-light text-neutral-7">
                {user.rate}
              </span>
            </div>
            <span className="text-10 font-extralight text-neutral-8">
              {user.title}
            </span>
          </div>
        </div>
      </div>

      {/* Profile Header in tablet and desktop screen */}
      <div className="hidden md:flex flex-row justify-between items-center">
        <div className="flex flex-row items-start gap-x-18 lg:gap-x-20">
          <div className="relative">
            <Avatar
              src={user.avatar || "/img/default-profile.png"}
              className="w-[68px] h-[68px] lg:w-[78px] lg:h-[78px]"
            />
            {isCurrentUser && (
              <div className="absolute -bottom-14 lg:-bottom-22 left-0 right-0 flex flex-row justify-between">
                {user.avatar ? (
                  <>
                    <ProfileBtn type="edit" mediumSize="sm" />
                    <ProfileBtn type="remove" mediumSize="sm" />
                  </>
                ) : (
                  <ProfileBtn type="add" mediumSize="sm" />
                )}
              </div>
            )}
          </div>

          <div>
            <div
              className={`flex ${isCurrentUser ? "flex-col  py-2 lg:py-[3px]" : "flex-row gap-x-36 lg:gap-x-[48px] items-center"}`}
            >
              <span
                className={`text-17 lg:text-20 font-medium text-neutral-7 ${isCurrentUser ? "mb-6 lg:mb-[7px]" : ""}`}
              >
                {user.username}
              </span>
              <span
                className={`text-12 lg:text-14 font-light text-neutral-8 ${isCurrentUser ? "mb-10 lg:mb-[15px]" : ""}`}
              >
                {user.title}
              </span>
              <div className="flex flex-row">
                <div
                  className={`flex flex-row-reverse items-center gap-x-6 lg:gap-x-8 pr-4 lg:pr-[5px] ${!isCurrentUser ? "pr-0 lg:pr-0" : ""}`}
                >
                  <StarIcon
                    className="w-16 h-16 lg:w-18 lg:h-18 text-yellow-400 rounded-full"
                    filled={true}
                  />
                  <span
                    className={`text-12 lg:text-14 font-regular lg:font-medium leading-[0] text-neutral-7 pt-[3px] lg:pt-[3.5px] ${!isCurrentUser ? "pt-0 lg:pt-0" : ""}`}
                  >
                    {user.rate}
                  </span>
                </div>
              </div>
            </div>
            {!isCurrentUser && (
              <FollowBtn className="mt-14 lg:mt-16" type="sm" />
            )}
          </div>
        </div>

        <div>
          <ul
            className={`flex flex-row gap-x-14 ${isCurrentUser ? "mb-20 lg:mb-22" : ""}`}
          >
            {userStatsItems.map((item) => {
              return (
                <UserStat
                  key={item.id}
                  label={item.label}
                  value={user.stats[item.id]}
                />
              );
            })}
          </ul>

          {isCurrentUser && (
            <p className="text-12 font-light text-neutral-7 text-left">
              {user.email}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
