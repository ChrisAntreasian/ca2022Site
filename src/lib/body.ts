const bodyClass =
  (className: string) => (node: HTMLElement, toggled: boolean) => {
    node.classList.toggle(className, toggled);

    return {
      update(toggled: boolean) {
        node.classList.toggle(className, toggled);
      },
      destroy() {
        node.classList.remove(className);
      },
    };
  };

export const noScroll = bodyClass("no-scroll");
