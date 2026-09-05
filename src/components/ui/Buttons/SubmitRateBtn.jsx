const className =
  "inline-flex items-center justify-center rounded-md border py-6 px-10 border-yellow-500 text-yellow-600 bg-neutral-1 text-12 font-normal transition-colors hover:bg-yellow-600 hover:text-neutral-1 hover:border-yellow-600 md:py-[9px] md:px-12 md:text-14 md:font-medium lg:py-10 lg:px-20 lg:text-16 lg:font-semibold";

export default function SubmitRateBtn() {
  return (
    <button type="button" className={className}>
      ثبت امتیاز
    </button>
  );
}
