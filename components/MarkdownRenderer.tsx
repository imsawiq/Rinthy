import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

type MarkdownRendererProps = {
  content: string;
  className?: string;
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => (
  <div className={className}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        rehypeRaw,
        [
          rehypeSanitize,
          {
            ...defaultSchema,
            tagNames: [
              ...(defaultSchema.tagNames || []),
              'details',
              'summary',
              'kbd',
              'sub',
              'sup',
              'del',
              'ins',
              'center',
              'iframe'
            ],
            attributes: {
              ...defaultSchema.attributes,
              a: [...(defaultSchema.attributes?.a || []), ['target', '_blank'], ['rel', 'noopener noreferrer']],
              img: [...(defaultSchema.attributes?.img || []), 'loading', 'decoding'],
              code: [...(defaultSchema.attributes?.code || []), 'className'],
              th: [...(defaultSchema.attributes?.th || []), 'align'],
              td: [...(defaultSchema.attributes?.td || []), 'align'],
              div: [...(defaultSchema.attributes?.div || []), 'align'],
              iframe: [
                'src',
                'width',
                'height',
                'title',
                'allow',
                'allowfullscreen',
                'frameborder'
              ]
            },
            protocols: {
              ...defaultSchema.protocols,
              href: ['http', 'https', 'mailto'],
              src: ['http', 'https']
            }
          }
        ]
      ]}
      components={{
        p: ({ node, children }) => {
          const childNodes = Array.isArray(node?.children) ? node.children : [];
          const meaningfulChildren = childNodes.filter((child: any) => !(child?.type === 'text' && String(child?.value || '').trim().length === 0));
          const multiInlineMedia =
            meaningfulChildren.length > 1 &&
            meaningfulChildren.every((child: any) => {
              if (child?.type !== 'element') return false;
              if (child.tagName === 'img') return true;
              if (child.tagName === 'a') {
                const linkChildren = Array.isArray(child.children) ? child.children : [];
                const meaningfulLinkChildren = linkChildren.filter((linkChild: any) => !(linkChild?.type === 'text' && String(linkChild?.value || '').trim().length === 0));
                return meaningfulLinkChildren.length > 0 && meaningfulLinkChildren.every((linkChild: any) => linkChild?.type === 'element' && linkChild.tagName === 'img');
              }
              return false;
            });

          if (multiInlineMedia) {
            return <p className="markdown-inline-media">{children}</p>;
          }
          return <p>{children}</p>;
        },
        a: ({ node: _node, ref: _ref, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        center: ({ node: _node, children }) => <div className="markdown-center">{children}</div>,
        img: ({ node: _node, ref: _ref, ...props }) => <img {...props} loading="lazy" decoding="async" alt={props.alt || ''} />,
        iframe: ({ node: _node, ref: _ref, src, ...props }) => {
          const allowed =
            typeof src === 'string' &&
            /^(https:\/\/(www\.)?youtube\.com\/embed\/|https:\/\/youtube\.com\/embed\/|https:\/\/www\.youtube-nocookie\.com\/embed\/|https:\/\/discord\.com\/widget\?)/i.test(src);

          if (!allowed) return null;

          return <iframe src={src} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" {...props} />;
        },
        code: ({ node: _node, ref: _ref, className: codeClassName, children, ...props }) => (
          <code className={codeClassName} {...props}>
            {children}
          </code>
        )
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);

export default React.memo(MarkdownRenderer);
