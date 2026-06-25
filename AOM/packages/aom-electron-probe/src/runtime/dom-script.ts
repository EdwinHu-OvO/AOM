export const installObserverExpression = `(() => {
  const key = "__aomProbeState";
  if (globalThis[key]) return true;
  const pathFor = (element) => {
    if (!(element instanceof Element)) return "";
    const parts = [];
    let current = element;
    while (current && current !== document.documentElement) {
      const siblings = current.parentElement
        ? [...current.parentElement.children].filter((item) => item.tagName === current.tagName)
        : [];
      const suffix = siblings.length > 1 ? ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")" : "";
      parts.unshift(current.tagName.toLowerCase() + suffix);
      current = current.parentElement;
    }
    return "html > " + parts.join(" > ");
  };
  const state = { events: [], pathFor };
  globalThis[key] = state;
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : undefined;
    state.events.push({
      type: "surface_click",
      rawId: target ? "dom:" + pathFor(target) : undefined,
      label: target?.getAttribute("aria-label") || target?.textContent?.trim().slice(0, 120)
    });
  }, true);
  document.addEventListener("input", (event) => {
    const target = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
      ? event.target
      : undefined;
    state.events.push({
      type: "surface_text_input",
      rawId: target ? "dom:" + pathFor(target) : undefined,
      inputType: target?.type || target?.tagName.toLowerCase()
    });
  }, true);
  new MutationObserver((records) => {
    state.events.push({
      type: "state_change",
      mutationCount: records.length,
      url: location.href
    });
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-expanded", "aria-selected", "disabled", "hidden"]
  });
  addEventListener("popstate", () => state.events.push({ type: "navigation", url: location.href }));
  addEventListener("hashchange", () => state.events.push({ type: "navigation", url: location.href }));
  return true;
})()`;

export const runtimeSnapshotExpression = `(() => {
  const pathFor = globalThis.__aomProbeState?.pathFor;
  if (!pathFor) return [];
  const visible = (element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
  };
  const domNodes = [...document.querySelectorAll("body *")].filter(visible).map((element) => {
    const rawId = "dom:" + pathFor(element);
    const role = element.getAttribute("role") || ({
      A: "link", BUTTON: "button", INPUT: "input", SELECT: "select", TEXTAREA: "textbox"
    })[element.tagName];
    const label = element.getAttribute("aria-label")
      || element.getAttribute("title")
      || (element.children.length === 0 ? element.textContent?.trim().slice(0, 160) : undefined);
    return {
      rawId,
      kind: "dom_element",
      role,
      label,
      value: "value" in element && element.type !== "password" ? element.value : undefined,
      attributes: {
        tagName: element.tagName.toLowerCase(),
        disabled: Boolean(element.disabled),
        inputType: element.type || null
      },
      children: [...element.children].map((child) => "dom:" + pathFor(child))
    };
  });
  const storageNodes = [
    ...Object.keys(localStorage).map((key) => ({
      rawId: "storage:local:" + key,
      kind: "storage_key",
      label: key,
      attributes: { namespace: "localStorage" },
      children: []
    })),
    ...Object.keys(sessionStorage).map((key) => ({
      rawId: "storage:session:" + key,
      kind: "storage_key",
      label: key,
      attributes: { namespace: "sessionStorage" },
      children: []
    }))
  ];
  return [...domNodes, ...storageNodes];
})()`;

export const drainDomEventsExpression =
  `(() => globalThis.__aomProbeState ? globalThis.__aomProbeState.events.splice(0) : [])()`;
