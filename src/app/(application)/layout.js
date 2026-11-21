import MainNavigation from "@/components/layout/navigation/MainNavigation";
import MenuProvider from "@/components/layout/navigation/MenuContext";
import TopNavigation from "@/components/layout/navigation/TopNavigation";
import Footer from "@/components/shared/Footer";

export default function ApplicationLayout({ children }) {
  return (
    <MenuProvider>
      <div className="min-h-dvh">
        <MainNavigation />

        <div className="flex min-h-dvh flex-col lg:mr-[320px]">
          <TopNavigation />

          <main className="flex-1">{children}</main>

          <Footer />
        </div>
      </div>
    </MenuProvider>
  );
}
