// export default function StepRow ({step}) {
export default function StepRow({}) {
  // Fake data
  const step = {
    title: "مرحله 1 : تخم مرغ و شکر را با هم مخلوط کنید",
    desc: "شکر را در کاسه بزرگی بریزید. تخم‌مرغ‌های هم دمای محیط را به آن اضافه کنید. با همزن دستی یا برقی مواد را هم بزنید تا رنگ آن روشن‌تر و بافتش کش‌دار شود. این مرحله پایه‌ی بافت براونی است.",
  };

  return (
    <li className="w-full px-16 pt-20 pb-18 md:pr-14 md:pl-16 lg:pr-18 lg:pt-20 lg:pb-20 lg:pl-20 flex flex-row items-stretch gap-x-16 lg:gap-x-22 bg-neutral-1 border border-neutral-3 shadow-card rounded-2xl lg:rounded-[20px]">
      <span className="block shrink-0 py-10 md:py-12 lg:py-14 w-[3px] after:content-[''] after:inline-block after:w-full after:h-full after:bg-red-400 after:rounded-full"></span>
      <div className="flex flex-col gap-y-4 lg:gap-y-2 text-neutral-8">
        <h3 className="text-13 lg:text-16 font-semibold leading-[189%]">
          {step.title}
        </h3>
        <p className="text-12 lg:text-14 font-light leading-[200%]">
          {step.desc}
        </p>
      </div>
    </li>
  );
}
