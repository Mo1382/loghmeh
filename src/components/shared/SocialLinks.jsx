import { InstagramIcon, TelegramIcon, XIcon } from "@/components/icons";

const logoClassName =
  "px-8 border-r border-neutral-5 h-full flex justify-center items-center lg:px-10";

const linkClassName =
  "w-full px-10 flex items-center text-left h-full text-neutral-8 text-14 font-regular lg:text-15 lg:pl-10 lg:pr-12";

const socialLinksList = [
  {
    id: "instagram",
    Icon: InstagramIcon,
  },
  {
    id: "telegram",
    Icon: TelegramIcon,
  },
  {
    id: "x",
    Icon: XIcon,
  },
];

function SocialLink({ Icon, link, isX }) {
  return (
    <div className="flex w-fit min-w-[132px] shrink-0 flex-row-reverse h-[42px] rounded-lg bg-neutral-1 border border-neutral-5 md:rounded-[10px] lg:h-[46px]">
      <span className={logoClassName}>
        <Icon
          className={`h-26 w-26 stroke-[1px] ${isX ? "text-neutral-6" : "text-neutral-7"}`}
        />
      </span>
      <span dir="ltr" type="text" className={linkClassName}>
        {link}
      </span>
    </div>
  );
}

// export default function SocialLinks({ userLinks }) {
export default function SocialLinks({}) {
  const userLinks = {
    instagram: "aliali_aa",
    telegram: "ali_8292",
    x: "ali_aa_82",
  };

  return (
    <ul className="flex flex-row-reverse flex-wrap gap-x-16 md:gap-x-24 lg:gap-x-28 gap-y-16">
      {socialLinksList.map((social) => {
        if (!userLinks[social.id]) return;

        return (
          <SocialLink
            key={social.id}
            Icon={social.Icon}
            link={userLinks[social.id]}
            isX={social.id === "x"}
          />
        );
      })}
    </ul>
  );
}
