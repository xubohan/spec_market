import { type ReactNode } from 'react';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Props = {
  markdown?: string;
  html?: string;
};

const ScrollContainer = ({ children }: { children: ReactNode }) => (
  <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-muted/20 bg-white/80 p-6 shadow-inner">
    {children}
  </div>
);

export const MarkdownView = ({ markdown, html }: Props) => {
  if (markdown && markdown.trim().length > 0) {
    return (
      <ScrollContainer>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          className="markdown-content"
          linkTarget="_blank"
        >
          {markdown}
        </ReactMarkdown>
      </ScrollContainer>
    );
  }

  if (html && html.trim().length > 0) {
    const sanitized = DOMPurify.sanitize(html);
    return (
      <ScrollContainer>
        <div className="markdown-content" dangerouslySetInnerHTML={{ __html: sanitized }} />
      </ScrollContainer>
    );
  }

  return <p className="text-muted">No content available.</p>;
};
