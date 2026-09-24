// Shows HTML that has already been cleaned on the server with renderRich() from lib/rich-text-server.
// Never pass it text that has not been through renderRich.
// The default look is for a paper page; pass onDark when it sits directly on the app's dark surface.
export function RichHtml({ html, className = "", onDark = false }: { html: string; className?: string; onDark?: boolean }) {
  return <div className={`paper-content ${onDark ? "on-dark" : ""} ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
