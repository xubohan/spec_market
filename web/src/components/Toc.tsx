import { TocItem } from '../types/spec';

export const Toc = ({ items }: { items?: TocItem[] }) => {
  if (!items?.length) return null;
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-muted">Table of Contents</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.id} style={{ paddingLeft: `${(item.level - 2) * 12}px` }}>
            <a href={`#${item.id}`} className="text-primary hover:underline">
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};
