// One compact navigation pattern for all FinScope pages except the comparison page,
// which has its own section controls in app.js.
if (!document.body.classList.contains("compare-page")) {
  function mountMobileNavigation() {
    const header = document.querySelector(".topbar, .global-header");
    const side = document.querySelector(".workspace-side, .side-nav");
    const nav = header?.querySelector("nav");
    if (!header || !side || !nav) return false;
    if (header.querySelector(".fs-mobile-menu-toggle")) return true;

    nav.id ||= "fs-global-links";
    side.id ||= "fs-section-links";
    const menuButton = document.createElement("button");
    menuButton.type = "button";
    menuButton.className = "fs-mobile-menu-toggle";
    menuButton.setAttribute("aria-controls", nav.id);
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg><span>전체 메뉴</span>';
    header.insertBefore(menuButton, nav);

    const sectionButton = document.createElement("button");
    sectionButton.type = "button";
    sectionButton.className = "fs-mobile-section-toggle";
    sectionButton.setAttribute("aria-controls", side.id);
    sectionButton.setAttribute("aria-expanded", "false");
    sectionButton.innerHTML = '<span>이 화면에서 이동</span><strong></strong><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>';
    side.prepend(sectionButton);

    const activeLabel = () => {
      const link = side.querySelector("a.active") || side.querySelector("a");
      sectionButton.querySelector("strong").textContent = link?.lastChild?.textContent?.trim() || "메뉴 보기";
    };
    const close = () => {
      document.body.classList.remove("fs-top-menu-open", "fs-section-menu-open");
      menuButton.setAttribute("aria-expanded", "false");
      sectionButton.setAttribute("aria-expanded", "false");
    };
    menuButton.addEventListener("click", () => {
      const open = !document.body.classList.contains("fs-top-menu-open");
      close();
      document.body.classList.toggle("fs-top-menu-open", open);
      menuButton.setAttribute("aria-expanded", String(open));
    });
    sectionButton.addEventListener("click", () => {
      const open = !document.body.classList.contains("fs-section-menu-open");
      close();
      document.body.classList.toggle("fs-section-menu-open", open);
      sectionButton.setAttribute("aria-expanded", String(open));
    });
    side.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
      activeLabel();
      close();
    }));
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".topbar, .global-header, .workspace-side, .side-nav")) close();
    });
    window.addEventListener("resize", () => { if (window.innerWidth > 760) close(); });
    new MutationObserver(activeLabel).observe(side, { subtree: true, attributes: true, attributeFilter: ["class"] });
    activeLabel();
    document.body.classList.add("fs-mobile-nav-ready");
    return true;
  }

  if (!mountMobileNavigation()) {
    const observer = new MutationObserver(() => { if (mountMobileNavigation()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}
