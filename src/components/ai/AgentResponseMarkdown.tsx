import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface AgentResponseMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Renders agent chat replies with GFM tables and clickable task links
 * (ActiveCollab-style markdown output).
 */
export function AgentResponseMarkdown({ content, className }: AgentResponseMarkdownProps) {
  return (
    <div
      className={cn(
        "overflow-x-auto text-sm prose prose-sm prose-slate dark:prose-invert max-w-none",
        "prose-p:my-1.5 prose-headings:mb-1 prose-headings:mt-2 prose-strong:font-semibold",
        "prose-a:text-primary prose-a:font-medium prose-a:no-underline hover:prose-a:underline",
        "prose-table:my-3 prose-table:w-full prose-table:text-xs prose-table:border-collapse",
        "prose-thead:bg-muted/50",
        "prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:whitespace-nowrap",
        "prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2 prose-td:align-top",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
