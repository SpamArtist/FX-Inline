const EXTENSION_INSTALL_REASON = "install";

export function shouldOpenWelcomePage(reason: string | undefined): boolean {
  return reason === EXTENSION_INSTALL_REASON;
}
