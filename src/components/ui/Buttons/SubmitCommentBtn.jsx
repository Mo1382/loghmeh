import MessageSquare from "@/components/icons/MessageSquare";

const className =
  "text-12 font-normal gap-x-1.25 rounded-default py-6 px-10 md:text-14 md:gap-x-6 md:rounded-md md:py-8 md:pr-12 md:pl-14 lg:text-16 lg:font-semibold lg:gap-x-8 lg:rounded-md lg:py-2.75 lg:pr-12 lg:pl-3.75";

const iconClassName = "h-14 w-14 stroke-2 md:h-18 md:w-18  lg:h-22 lg:w-22";

export default function SubmitCommentBtn() {
  return (
    <button
      type="button"
      className={`inline-flex items-center bg-red-500 text-white transition-colors hover:bg-red-hover ${className}`}
    >
      <MessageSquare className={iconClassName} />
      <span>ثبت دیدگاه</span>
    </button>
  );
}
