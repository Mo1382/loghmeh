const baseClassName = `
  block w-full whitespace-normal break-words text-right
  text-12 leading-[18px] text-red-600
  md:text-13 md:leading-5
  lg:text-14 lg:leading-[21px]
`;

export default function FormErrorMessage({ message, id, className = "" }) {
  const text = typeof message === "string" ? message.trim() : "";

  if (!text) {
    return null;
  }

  return (
    <p
      id={id}
      role="alert"
      title={text}
      className={`${baseClassName} ${className}`}
    >
      {text}
    </p>
  );
}
