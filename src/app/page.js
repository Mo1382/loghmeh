import Filter from "@/components/shared/Filter";

export default function Home() {
  // const [activeTab, setActiveTab] = useState("profile");

  return (
    <main className="w-full">
      <div className="mx-auto max-[1400px] mx-28 my-24">
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
        <Filter />
      </div>
    </main>
  );
}
