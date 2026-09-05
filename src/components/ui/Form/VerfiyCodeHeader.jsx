const className =
  "block w-fit text-right text-12 font-light text-neutral-7 md:text-14 lg:text-16";

const emailClassName = "font-normal text-neutral-8";

export default function VerfiyCodeHeader({
  email = "mahdimms.expert999@gmail.com",
}) {
  return (
    <p className={className}>
      <span className="md:hidden">
        کد به ایمیل <span className={emailClassName}>{email}</span> ارسال شد.
      </span>
      <span className="hidden md:inline">
        کد ارسالی به ایمیل <span className={emailClassName}>{email}</span> را
        وارد نمایید.
      </span>
    </p>
  );
}
