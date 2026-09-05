const className =
  "block w-fit text-right text-12 font-normal text-neutral-7 md:text-13 lg:text-14";

export default function FormFooter({ children }) {
  return <p className={className}>{children}</p>;
}
