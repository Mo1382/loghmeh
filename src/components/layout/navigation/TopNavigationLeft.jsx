import { SupportIcon } from "@/components/icons";
import NotificationBellIcon from "@/components/icons/NotificationBell";
import Avatar from "@/components/ui/Avatar";
import SignInNavBtn from "@/components/ui/Buttons/SignInNavBtb";

export default function NavigationLeft({}) {
  // Fake data
  const isAnyUnreadNotif = false;
  const user = { username: "mohammad_82", avatar: "/img/avatar.png" };
  //   const user = undefined;

  return (
    <div className="flex flex-row items-center justify-end">
      <span className="inline-block">
        <SupportIcon className="cursor-pointer text-neutral-8 hover:text-red-400 transition-colors w-24 h-24 ml-14 md:w-26 md:h-26 md:ml-18 lg:w-28 lg:h-28 lg:ml-26" />
      </span>
      <span className="inline-block relative">
        <NotificationBellIcon className="cursor-pointer text-neutral-9 hover:text-red-400 transition-colors w-24 h-24 ml-14 md:w-26 md:h-26 md:ml-24 lg:w-28 lg:h-28 lg:ml-32" />
        {isAnyUnreadNotif && (
          <span className="absolute top-[1px] right-[3px] md:top-[2px] md:right-4 w-8 h-8 bg-red-500 border border-[2px] border-neutral-2 rounded-full"></span>
        )}
      </span>

      <div className="flex items-center cursor-pointer">
        {user ? (
          <div className="flex flex-row items-center md:gap-x-16">
            <Avatar src={user.avatar} className="w-24 md:w-40 lg:w-[42px]" />
            <span className="hidden md:inline-block md:text-14 md:font-medium lg:text-15 text-neutral-8">
              {user.username}
            </span>
          </div>
        ) : (
          <SignInNavBtn />
        )}
      </div>
    </div>
  );
}
