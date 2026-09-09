const StarIcon = ({ className, filled = false }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill={filled ? "currentColor" : "none"}
    viewBox="0 0 40 40"
    className={className}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.552 4.242a.5.5 0 0 1 .896 0l4.586 9.29a.5.5 0 0 0 .376.273l10.255 1.499a.5.5 0 0 1 .276.853l-7.42 7.226a.5.5 0 0 0-.143.443l1.75 10.209a.5.5 0 0 1-.725.527l-9.17-4.823a.5.5 0 0 0-.466 0l-9.17 4.823a.5.5 0 0 1-.726-.527l1.751-10.21a.5.5 0 0 0-.144-.442l-7.42-7.226a.5.5 0 0 1 .277-.853l10.255-1.5a.5.5 0 0 0 .376-.273z"
    />
  </svg>
);
export default StarIcon;
