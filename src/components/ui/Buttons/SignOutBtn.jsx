import { LogOutIcon } from "@/components/icons";

export default function SignOutBtn({}) {
  return (
    <button className="group flex flex-row items-center gap-x-8 pr-14 cursor-pointer ">
      <LogOutIcon className="transition-colors duration-300 w-24 h-24 text-neutral-9 group-hover:text-red-400" />
      <span className="transition-colors duration-300 text-16 font-regular text-neutral-9 group-hover:text-red-400">
        خروج
      </span>
    </button>
  );
}
