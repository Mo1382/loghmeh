import SignInSmallBtn from "../ui/Buttons/SignInSmallBtn";

export default function NotAuthError({
  children: errorMsg = "ابتدا باید وارد حساب کاربری خود شوید",
  type = "recipe",
}) {
  const isRecipe = type === "recipe";
  const isComment = type === "comment";
  const isRate = type === "rate";

  const wrapperClassName = `w-fit flex flex-col justify-center items-center ${isRecipe ? "gap-y-24 lg:gap-y-36" : ""}  ${isComment || isRate ? "gap-y-20" : ""} ${isComment ? "lg:gap-y-26" : ""} ${isRate ? "lg:gap-y-30" : ""}`;

  const msgClassName = `text-center font-light text-neutral-8 h-auto ${isRecipe ? "text-13 md:text-15 leading-[210%] max-w-[324px] md:max-w-[436px] lg:text-16 lg:max-w-[466px]" : ""} ${isComment || isRate ? "text-11 leading-[186%] max-w-[292px]" : ""} ${isComment ? "md:text-12 lg:text-13 md:max-w-[270px] lg:max-w-[336px]" : ""} ${isRate ? "md:text-12 md:max-w-[250px] lg:text-13 lg:max-w-[276px]" : ""} `;

  return (
    <div className={wrapperClassName}>
      <p className={msgClassName}>{errorMsg}</p>

      <SignInSmallBtn type={isRecipe ? "lg" : "sm"} />
    </div>
  );
}
