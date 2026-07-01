import DOMPurify from "dompurify";

/**
 * Sanitizes HTML content to prevent XSS attacks
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "a",
      "code",
      "pre",
      "blockquote",
    ],
    ALLOWED_ATTR: ["href", "title", "target"],
  });
}

/**
 * Sanitizes HTML for rich text editors (more permissive)
 */
export function sanitizeRichText(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "a",
      "img",
      "code",
      "pre",
      "blockquote",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "span",
      "div",
    ],
    ALLOWED_ATTR: [
      "href",
      "title",
      "target",
      "src",
      "alt",
      "class",
      "style",
      "width",
      "height",
      "data-task-attachment-id",
    ],
  });
}

/**
 * Strips all HTML tags
 */
export function stripHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] });
}

/**
 * Sanitizes user input for display
 */
export function sanitizeInput(input: string): string {
  return input.trim().replace(/<script[^>]*>.*?<\/script>/gi, "");
}

/**
 * Sanitizes filename to prevent directory traversal
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-z0-9._-]/gi, "_").replace(/\.{2,}/g, ".");
}

/**
 * Escapes special characters for PostgreSQL ilike/like queries.
 * Prevents characters like %, _, and \ from being interpreted as wildcards.
 */
export function sanitizeSearchInput(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}
