import Logo from "@/components/ui/Logo";
import NavigationLeft from "./TopNavigationLeft";
import SearchBar from "./TopNavigationRight";
import MenuIcon from "@/components/icons/Menu";
import MenuOpen from "./MenuOpen";

export default function TopNavigation({}) {
  return (
    <nav className="w-full flex flex-row justify-between items-center px-24 py-16 md:pt-10 md:pb-18 md:px-24 lg:py-30 lgLpx-40 border-b border-neutral-4">
      <div className="flex flex-row md:gap-x-24 lg:gap-x-0">
        <MenuOpen />
        <SearchBar />
      </div>
      <Logo type="sm" className="hidden md2:inline-block lg:hidden" />
      <NavigationLeft />
    </nav>
  );
}
