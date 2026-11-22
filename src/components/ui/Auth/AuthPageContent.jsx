export default function AuthPageContent({
  title,
  icon: Icon,
  headingId,
  children,
}) {
  return (
    <section
      aria-labelledby={headingId}
      className="
        relative flex min-h-dvh w-full flex-col
        items-center justify-center bg-neutral-2

        max-w-[700px]

        md:max-w-[608px]

        lg:max-w-none lg:w-1/2 lg:right-1/2
        lg:px-40
      "
    >
      {/* Page heading */}
      <header dir="ltr" className="flex w-full items-center justify-end gap-8">
        <h1
          id={headingId}
          className="
            text-18 font-medium text-neutral-8
            md:text-22
            lg:text-26 lg:font-semibold
          "
        >
          {title}
        </h1>

        <Icon
          aria-hidden="true"
          className="
            size-24 shrink-0 text-neutral-8
            lg:size-28
          "
        />
      </header>

      {children}
    </section>
  );
}
