import { type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Props = {
  markdown?: string;
};

const ScrollContainer = ({ children }: { children: ReactNode }) => (
  <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-muted/20 bg-white/80 p-6 shadow-inner">
    {children}
  </div>
);

export const MarkdownView = ({ markdown }: Props) => {
  if (markdown && markdown.trim().length > 0) {
    return (
      <ScrollContainer>
        <div className="markdown-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      </ScrollContainer>
    );
  }

  return <p className="text-muted">No content available.</p>;
};
