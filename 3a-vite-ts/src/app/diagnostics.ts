// Debug globals (__frames/__ready/__errors) and the fatal error overlay.

window.__frames = 0;
window.__ready = false;
window.__fatal = null;
window.__errors = [];
export function showFatal(i: string) {
  window.__fatal = String(i);
  console.error("[fatal] " + i);
  let e = document.getElementById("fatal");
  if (!e) {
    e = document.createElement("div");
    e.id = "fatal";
    document.getElementById("app")!.appendChild(e);
  }
  e.textContent = "几猫启动失败：" + i;
}
window.addEventListener("error", (i) => {
  window.__errors.push(String(i.message));
});
{
  let i = console.error.bind(console);
  console.error = (...e) => {
    try {
      window.__errors.push(
        e
          .map((t) => (t && t.stack) || String(t))
          .join(" ")
          .slice(0, 400),
      );
    } catch {}
    i(...e);
  };
}
