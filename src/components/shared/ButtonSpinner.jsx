import { PulseLoader } from "react-spinners";

export default function ButtonSpinner({ color = "var(--color-neutral-1)" }) {
  return (
    <span
      aria-hidden="true"
      className="
        pointer-events-none absolute inset-0 z-20
        flex items-center justify-center
        rounded-[inherit] bg-inherit
      "
    >
      <PulseLoader color={color} size={5} margin={2} speedMultiplier={0.75} />
    </span>
  );
}
