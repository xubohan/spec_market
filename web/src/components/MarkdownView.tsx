import DOMPurify from 'dompurify';

type Props = {
  html?: string;
};

export const MarkdownView = ({ html }: Props) => {
  if (!html) {
    return <p className="text-muted">No content available.</p>;
  }
  const sanitized = DOMPurify.sanitize(html);
  return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: sanitized }} />;
};
