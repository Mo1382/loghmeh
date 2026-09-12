import { InstagramIcon, TelegramIcon, XIcon } from "../icons";

const appLinksList = [
  {
    id: "instagram",
    Icon: InstagramIcon,
    address: "loghmeh.co",
  },
  {
    id: "telegram",
    Icon: TelegramIcon,
    address: "loghmeh-news",
  },
  {
    id: "x",
    Icon: XIcon,
    address: "loghmeh.co",
  },
];

function AppLink({ link: { address, Icon }, isX }) {
  return (
    <li className="flex flex-row-reverse items-center gap-x-8 md:gap-x-10 lg:gap-x-12">
      <Icon
        className={`${isX ? "text-red-300" : "text-red-400"} w-30 h-30 md:w-36 md:h-36 lg:w-[48px] lg:h-[48px] stroke-2`}
      />
      <span className="text-14 font-medium text-neutral-7 md:text-15 lg:text-18">
        {address}
      </span>
    </li>
  );
}

export default function AppLinks() {
  return (
    <ul className="flex flex-row-reverse flex-wrap gap-x-24 gap-y-14 md:gap-x-32 lg:gap-x-[60px]">
      {appLinksList.map((link) => {
        return <AppLink key={link.id} link={link} isX={link.id === "x"} />;
      })}
    </ul>
  );
}
