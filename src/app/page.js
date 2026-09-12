import { CheckCircleIcon, ClockIcon, ImageIcon } from "@/components/icons";
import AlertCircleIcon from "@/components/icons/AlertCircle";
import AppError from "@/components/shared/AppError";
import AppLinks from "@/components/shared/AppLinks";
import BookmarkRecipe from "@/components/shared/BookmarkRecipe";
import Footer from "@/components/shared/Footer";
import Modal from "@/components/shared/Modal";
import NoItemExist from "@/components/shared/NoItemExist";
import NotAuthError from "@/components/shared/NotAuthError";
import NoItemFound from "@/components/shared/NotFound";
import Notification from "@/components/shared/Notification";
import NotificationRow from "@/components/shared/NotificationRow";
import ProfileHeader from "@/components/shared/ProfileHeader";
import RecipeBadge from "@/components/shared/RecipeBadge";
import RecipeDetailHeader from "@/components/shared/RecipeDetailHeader";
import RecipeRate from "@/components/shared/RecipeRate";
import RecipeSlider from "@/components/shared/RecipeSilder";
import ServingsCounter from "@/components/shared/ServingsCounter";
import SocialLinks from "@/components/shared/SocialLinks";
import SocialLink from "@/components/shared/SocialLinks";
import Example from "@/components/shared/Test";
import Test2 from "@/components/shared/Test2";
import AddEditRecipeBtn from "@/components/ui/Buttons/AddRecipeBtn";
import ProfileBtn from "@/components/ui/Buttons/ProfileBtn";
import RateForm from "@/components/ui/Form/RateForm";
import SocialLinkForm from "@/components/ui/Form/SocialLinkForm";
import IngredientRow from "@/components/ui/IngredientRow";
import RecipeMetadata from "@/components/ui/RecipeMetadata";
import StepRow from "@/components/ui/StepRow";

export default function Home() {
  // const [activeTab, setActiveTab] = useState("profile");

  return (
    <main className="w-full">
      <div className="mx-auto max-w-[1000px] mx-28 my-24 flex flex-col gap-y-40 px-40">
        {/* <div> */}
        {/* <MyProfile /> */}
        {/* <BioForm /> */}
        {/* <SocialLinkForm /> */}
        {/* <RecipeCard /> */}
        {/* {<UserCard />} */}
        {/* {<CategoryCard />} */}
        {/* <SearchRecipeCard /> */}
        {/* <SignInNavBtn /> */}
        {/* <NavigationLeft /> */}
        {/* <SearchBar /> */}
        {/* <Navigation /> */}
        {/* <Logo type="lg" /> */}
        {/* <NavItem label="خانه" IconComponent={HomeIcon} type="mobile" /> */}
        {/* <MainNavigation /> */}
        {/* <SettingTabs activeTab={activeTab} onTabChange={setActiveTab} /> */}
        {/* <FilterSortBtn type="filter" /> */}
        {/* <Filter /> */}
        {/* <Sort /> */}
        {/* <Comment isUserRecipe={true} />
        <Comment type="reply" /> */}
        {/* <NoItemFound msg="برای فیلتر شما هیچ دستور پختی پیدا نشد." /> */}
        {/* <AppError /> */}
        {/* <NoItemExist msg="هنوز هیچ دستور پختی را ذخیره نکرده‌اید." /> */}
        {/* <NotAuthError type="recipe">
          برای دسترسی به این صفحه و ذخیره دستور پخت‌های دلخواه خود، ابتدا باید
          وارد حساب کاربری خود شوید.
        </NotAuthError>
        <NotAuthError type="comment">
          <>
            <span className="inline-block md:hidden">
              برای امتیاز دهی به این دستور پخت یا ثبت نظر در مورد آن، ابتدا باید
              وارد حساب کاربری خود شوید.
            </span>
            <span className="hidden md:inline-block">
              برای ثبت نظر یا واکنش به نظرات دیگر افراد، ابتدا باید وارد حساب
              کاربری خود شوید.
            </span>
          </>
        </NotAuthError>
        <NotAuthError type="rate">
          <>
            <span className="inline-block md:hidden">
              برای امتیاز دهی به این دستور پخت یا ثبت نظر در مورد آن، ابتدا باید
              وارد حساب کاربری خود شوید.
            </span>
            <span className="hidden md:inline-block">
              برای ذخیره‌ی دستور پخت در بخش دستور پخت‌های من یا امتیاز دهی به
              آن‌ها، ابتدا باید وارد حساب کاربری خود شوید.
            </span>
          </>
        </NotAuthError> */}
        {/* <Modal /> */}
        {/* <IngredientRow servingNumber={5} /> */}
        {/* <StepRow /> */}
        {/* <RecipeBadge>دسر</RecipeBadge> */}
        {/* <RecipeMetadata /> */}
        {/* <Footer /> */}
        {/* <Notification /> */}
        {/* <Example /> */}
        {/* <Test2 /> */}
        {/* <Example /> */}
        {/* <RecipeSlider
          recipes={[
            {
              rate: "4.5",
              img: "/img/chocolate-cake-with-chocolate-drops-cream.png",
              name: "کیک بروانی شکلاتی",
              category: "دسر",
              userImg: "/img/test-avatar.png",
              username: "Sara_953",
            },
            {
              rate: "4.5",
              img: "/img/chocolate-cake-with-chocolate-drops-cream.png",
              name: "کیک بروانی شکلاتی",
              category: "دسر",
              userImg: "/img/test-avatar.png",
              username: "Sara_953",
            },
            {
              rate: "4.5",
              img: "/img/chocolate-cake-with-chocolate-drops-cream.png",
              name: "کیک بروانی شکلاتی",
              category: "دسر",
              userImg: "/img/test-avatar.png",
              username: "Sara_953",
            },
            {
              rate: "4.5",
              img: "/img/chocolate-cake-with-chocolate-drops-cream.png",
              name: "کیک بروانی شکلاتی",
              category: "دسر",
              userImg: "/img/test-avatar.png",
              username: "Sara_953",
            },
            {
              rate: "4.5",
              img: "/img/chocolate-cake-with-chocolate-drops-cream.png",
              name: "کیک بروانی شکلاتی",
              category: "دسر",
              userImg: "/img/test-avatar.png",
              username: "Sara_953",
            },
            {
              rate: "4.5",
              img: "/img/chocolate-cake-with-chocolate-drops-cream.png",
              name: "کیک بروانی شکلاتی",
              category: "دسر",
              userImg: "/img/test-avatar.png",
              username: "Sara_953",
            },
          ]}
        /> */}

        {/* <NotificationRow /> */}
        {/* <RecipeRate avgRate={3.4} rateNumber={28} /> */}
        {/* <RecipeRate avgRate={4.55} rateNumber={0} /> */}
        {/* <BookmarkRecipe /> */}
        {/* <RateForm /> */}

        {/* <SocialLinks /> */}
        {/* <AppLinks /> */}

        {/* <ProfileHeader type="currentUser" /> */}
        {/* <ProfileHeader type="otherUser" /> */}

        <RecipeDetailHeader />

        {/* <ServingsCounter defaultServings={12} /> */}
      </div>
    </main>
  );
}
