export default function AuthLayout({ children }) {
  return (
    <main
      className="
        relative flex min-h-dvh w-full flex-col
        items-center justify-center
        bg-neutral-2 px-24
        md:px-[80px]
        lg:flex-row lg:justify-start lg:px-0
      "
    >
      {children}
    </main>
  );
}
