const className = `
  text-right text-12 font-normal text-neutral-8

  [&_a]:text-red-600
  [&_a]:transition-colors
  [&_a:hover]:text-red-hover

  [&_a:focus-visible]:rounded-sm
  [&_a:focus-visible]:outline-2
  [&_a:focus-visible]:outline-offset-2
  [&_a:focus-visible]:outline-red-600

  [&_strong]:font-semibold

  md:text-13
  lg:text-14
`;

export default function FormFooter({ children }) {
  return <p className={className}>{children}</p>;
}
