import * as React from "react";

const EVT = "ocp-mobile-nav";
let openState = false;

export function setMobileNav(open: boolean) {
  openState = open;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVT));
}

export function useMobileNav() {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const sync = () => setOpen(openState);
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, []);
  return { open, setOpen: setMobileNav, toggle: () => setMobileNav(!openState) };
}
