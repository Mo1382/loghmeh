const CloseIcon = ({ className, onClose }) => (
  <svg
    onClick={onClose}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 40 40"
    className={className}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M30 10 10 30M10 10l20 20"
    />
  </svg>
);
export default CloseIcon;
