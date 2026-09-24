// Shows HTML that has already been cleaned on the server with renderRich() from lib/rich-text-server.
// Never pass it text that has not been through renderRich.
export function RichHtml({ html, className = "" }: { html: string; className?: string }) {
  return <div className={`paper-content ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
