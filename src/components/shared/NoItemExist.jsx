export default function NoItemExist({ msg = "هیچ موردی پیدا نشد." }) {
  return (
    <p className="w-fit max-w-[250px] md:max-w-[280px] lg:max-w-[346px] text-neutral-8 text-13 font-light leading-[210%] md:text-15 lg:text-17">
      {msg}
    </p>
  );
}
