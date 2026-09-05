const className =
  "inline-flex text-12 font-normal text-red-500 transition-colors hover:text-red-hover md:text-14";

export default function FormFooterLink({ type = "login" }) {
  let label;
  if (type === "login") label = "وارد شوید";
  if (type === "register") label = "ثبت نام";
  if (type === "rules") label = "شرایط و ظوابط";
  if (type === "forgotPassword") label = "بازیابی رمز";

  return (
    // TODO Implement proper routing for these links
    <a href="#" className={className}>
      {label}
    </a>
  );
}
