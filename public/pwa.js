const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
// Every FinScope screen loads this shared script, so the guide stays available across menus.
import("/ai-guide.js?v=4").catch(() => {});
import("/sidebar-icons.js?v=1").catch(() => {});
let installPrompt = null;
let installButton = null;

function mountInstallButton() {
  if (isStandalone || installButton) return;
  const header = document.querySelector(".topbar, .global-header");
  if (!header) return;
  installButton = document.createElement("button");
  installButton.type = "button";
  installButton.className = "pwa-install-button";
  installButton.textContent = "앱으로 설치";
  installButton.hidden = !installPrompt;
  installButton.addEventListener("click", async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") installButton.hidden = true;
    installPrompt = null;
  });
  header.append(installButton);
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  mountInstallButton();
  if (installButton) installButton.hidden = false;
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  if (installButton) installButton.hidden = true;
});

if ("serviceWorker" in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then((registration) => registration.update())
      .catch(() => {});
    mountInstallButton();
  });
}
