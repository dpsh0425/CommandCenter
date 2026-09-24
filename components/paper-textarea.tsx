import { forwardRef, type TextareaHTMLAttributes } from "react";

// The paper look for plain text, used where the text must stay plain (for example email drafts).
export const PaperTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function PaperTextarea({ className = "", ...rest }, ref) {
  return <textarea ref={ref} className={`paper w-full ${className}`} {...rest} />;
});
