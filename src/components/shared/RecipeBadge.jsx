export default function RecipeBadge({ children: text }) {
  return (
    <span className="inline-flex w-fit bg-neutral-6 rounded-[6px] lg:rounded-[7px] px-8 py-4 text-9 md:text-10 lg:text-11 font-regular lg:font-medium text-neutral-1">
      {text}
    </span>
  );
}
