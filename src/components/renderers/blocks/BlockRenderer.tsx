import React, { useState, useEffect } from 'react';
import type {
  ContentBlock,
  TextBlock,
  HeadingBlock,
  ImageBlock,
  VideoBlock,
  AudioBlock,
  BlockquoteBlock,
  ListBlock,
  TableBlock,
  CodeBlock,
  FigureBlock,
  RawHtmlBlock,
} from '../../../types/blocks';
import { useInView } from '../../../../hooks/useInView';
import { useBlobManager } from '../../../../hooks/useBlobManager';

interface BlockRendererProps {
  block: ContentBlock;
  mode: 'edit' | 'read' | 'print';
}

const ParagraphBlock = React.memo<{ block: TextBlock }>(({ block }) => (
  <p dangerouslySetInnerHTML={{ __html: block.content }} />
));

const HeadingBlockComponent = React.memo<{ block: HeadingBlock }>(({ block }) => {
  const Tag = `h${block.level}` as keyof React.JSX.IntrinsicElements;
  return <Tag dangerouslySetInnerHTML={{ __html: block.content }} />;
});

const ImageBlockComponent = React.memo<{ block: ImageBlock; mode: string }>(({ block, mode }) => {
  const [loaded, setLoaded] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobManager = useBlobManager();
  const { ref, inView } = useInView({ rootMargin: '50px', threshold: 0.01 });

  useEffect(() => {
    if (!inView || !block.src) {
      setBlobUrl(null);
      return;
    }
    const timer = setTimeout(() => {
      const url = blobManager.getBlobUrl(block.src);
      setBlobUrl(url);
    }, 0);
    return () => clearTimeout(timer);
  }, [inView, block.src, blobManager]);

  const imageSrc = inView ? (blobUrl || block.src) : undefined;

  return (
    <img
      ref={ref as React.Ref<HTMLImageElement>}
      src={imageSrc}
      alt={block.alt || ''}
      referrerPolicy="no-referrer"
      className={`sws-block-image ${loaded ? 'loaded' : ''}`}
      style={{ opacity: loaded ? 1 : 0.8, transition: 'opacity 0.2s ease-out' }}
      onLoad={() => setLoaded(true)}
    />
  );
});

const VideoBlockComponent = React.memo<{ block: VideoBlock }>(({ block }) => (
  <div className="media-container">
    <video src={block.src} controls className="sws-block-video" />
  </div>
));

const AudioBlockComponent = React.memo<{ block: AudioBlock }>(({ block }) => (
  <div className="media-container">
    <audio src={block.src} controls className="sws-block-audio" />
  </div>
));

const BlockquoteBlockComponent = React.memo<{ block: BlockquoteBlock }>(({ block }) => (
  <blockquote dangerouslySetInnerHTML={{ __html: block.content }} />
));

const ListBlockComponent = React.memo<{ block: ListBlock }>(({ block }) => {
  const Tag = block.listType === 'ordered' ? 'ol' : 'ul';
  return (
    <Tag>
      {block.items.map((item, i) => (
        <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
      ))}
    </Tag>
  );
});

const TableBlockComponent = React.memo<{ block: TableBlock }>(({ block }) => (
  <table>
    <tbody>
      {block.rows.map((row, i) => (
        <tr key={i}>
          {row.map((cell, j) => (
            <td key={j} dangerouslySetInnerHTML={{ __html: cell }} />
          ))}
        </tr>
      ))}
    </tbody>
  </table>
));

const CodeBlockComponent = React.memo<{ block: CodeBlock }>(({ block }) => (
  <pre>
    <code className={block.language ? `language-${block.language}` : undefined}>
      {block.content}
    </code>
  </pre>
));

const FigureBlockComponent = React.memo<{ block: FigureBlock; mode: string }>(({ block, mode }) => (
  <figure>
    <ImageBlockComponent block={{ id: 'fig-img', type: 'image', ...block.image }} mode={mode} />
    {block.caption && <figcaption>{block.caption}</figcaption>}
  </figure>
));

const RawHtmlBlockComponent = React.memo<{ block: RawHtmlBlock }>(({ block }) => (
  <div dangerouslySetInnerHTML={{ __html: block.html }} />
));

export const BlockRenderer = React.memo<BlockRendererProps>(({ block, mode }) => {
  switch (block.type) {
    case 'paragraph':
      return <ParagraphBlock block={block} />;
    case 'heading':
      return <HeadingBlockComponent block={block} />;
    case 'image':
      return <ImageBlockComponent block={block} mode={mode} />;
    case 'video':
      return <VideoBlockComponent block={block} />;
    case 'audio':
      return <AudioBlockComponent block={block} />;
    case 'blockquote':
      return <BlockquoteBlockComponent block={block} />;
    case 'list':
      return <ListBlockComponent block={block} />;
    case 'table':
      return <TableBlockComponent block={block} />;
    case 'code':
      return <CodeBlockComponent block={block} />;
    case 'hr':
      return <hr className="sws-hr" />;
    case 'figure':
      return <FigureBlockComponent block={block} mode={mode} />;
    case 'pdf':
      return null;
    case 'rawHtml':
      return <RawHtmlBlockComponent block={block} />;
    default:
      return null;
  }
});
