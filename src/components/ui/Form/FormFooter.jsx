const className = `
  text-right text-12 font-normal text-neutral-7
  [&_a]:text-red-500
  [&_a]:transition-colors
  [&_a:hover]:text-red-hover
  [&_strong]:font-semibold

  md:text-13

  lg:text-14
`;

export default function FormFooter({ children }) {
  return <p className={className}>{children}</p>;
}
