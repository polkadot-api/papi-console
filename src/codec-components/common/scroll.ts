export function synchronizeScroll(
  scrollingElement: HTMLElement,
  targetElement: HTMLElement,
) {
  const onScroll = async () => {
    const buffer = targetElement.offsetHeight / 3
    const listScrollPos =
      Math.max(0, scrollingElement.scrollTop - buffer) /
      (scrollingElement.scrollHeight - scrollingElement.offsetHeight)

    targetElement.scrollTop =
      listScrollPos *
      (targetElement.scrollHeight - targetElement.offsetHeight + buffer / 2)
  }

  scrollingElement.addEventListener("scroll", onScroll)
  // Used as scroll target for markers...
  // Otherwise smooth scroll with `element.scrollIntoView` gets interrupted.
  // This should be passed probably by context, but at this scale it works.
  ;(window as any).scrollingElement = scrollingElement
  return () => {
    scrollingElement.removeEventListener("scroll", onScroll)
    ;(window as any).scrollingElement = null
  }
}

export const scrollToMarker = (id: string[]) => {
  const element = document.getElementById("marker-" + id.join("."))
  if (!element) return

  const scrollingElement: HTMLElement = (window as any).scrollingElement
  if (scrollingElement) {
    const elementRect = element.getBoundingClientRect()
    const scrollRect = scrollingElement.getBoundingClientRect()

    scrollingElement.scrollBy({
      top: elementRect.top - scrollRect.top - 50,
      behavior: "smooth",
    })
  } else {
    element.scrollIntoView({ behavior: "instant" })
  }
}
