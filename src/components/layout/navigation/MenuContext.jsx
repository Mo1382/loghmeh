"use client";

import { createContext, useContext, useState } from "react";

const MenuContext = createContext(null);

export default function MenuProvider({ children }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const openMenu = () => {
    setIsMenuOpen(true);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <MenuContext.Provider
      value={{
        isMenuOpen,
        openMenu,
        closeMenu,
      }}
    >
      {children}
    </MenuContext.Provider>
  );
}

export function useMenu() {
  const context = useContext(MenuContext);

  if (!context) {
    throw new Error("useMenu must be used inside MenuProvider");
  }

  return context;
}
