import { InstagramIcon, TelegramIcon, XIcon } from "../icons";

const iconClassName = "w-22 h-22 lg:w-24 lg:h-24 stroke-2";

export default function Footer() {
  return (
    <footer className="flex flex-row items-center justify-center md:justify-between bg-neutral-3 border border-neutral-4 rounded-t-xl md:rounded-t-[14px] py-12 w-full md:py-16 md:px-24 lg:px-28 lg:py-18 lg:rounded-t-2xl">
      <p className="text-10 font-regular text-neutral-7 md:text-12 lg:text-14">
        کلیه حقوق استفاده از محتوای این وب سایت نزد شرکت لقمه محفوظ است.
      </p>
      <div className="hidden md:inline-flex flex-row gap-x-20 lg:gap-x-22">
        <XIcon className={`${iconClassName} text-neutral-7`} />
        <TelegramIcon className={`${iconClassName} text-neutral-8`} />
        <InstagramIcon className={`${iconClassName} text-neutral-8`} />
      </div>
    </footer>
  );
}
