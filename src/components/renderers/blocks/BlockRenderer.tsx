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
} from '../../../types';
import { useInView } from '../../../../hooks/useInView';
import { useBlobManager } from '../../../../hooks/useBlobManager';
import { sanitizeHtml } from '../../../utils/sanitizeHtml';
import { isSelfGeneratedHtmlCached } from '../../../utils/htmlTrust';

interface BlockRendererProps {
  block: ContentBlock;
  mode: 'edit' | 'read' | 'print';
}

const ParagraphBlock = React.memo<{ block: TextBlock }>(({ block }) => (
  <p dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }} />
));

const HeadingBlockComponent = React.memo<{ block: HeadingBlock }>(({ block }) => {
  const Tag = `h${block.level}` as keyof React.JSX.IntrinsicElements;
  return <Tag dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }} />;
});

const ImageBlockComponent = React.memo<{ block: ImageBlock; mode: string }>(({ block, mode }) => {
  const [loaded, setLoaded] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobManager = useBlobManager();
  const { ref, inView } = useInView();
  // 打印模式不过视口懒加载，直接解码渲染
  const bypassLazy = mode === 'print';

  useEffect(() => {
    const src = block.src;
    if (!src) {
      setBlobUrl(null);
      return;
    }
    if (!bypassLazy && !inView) {
      setBlobUrl(null);
      return;
    }
    let cancelled = false;
    // 延后一帧发起，避免滚动过程中同时触发大量解码
    const timer = setTimeout(() => {
      blobManager.getBlobUrlAsync(src).then((url) => {
        if (!cancelled) setBlobUrl(url);
      });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [inView, block.src, blobManager, bypassLazy]);

  // data URL 在解码完成前不直接当 src 用，避免浏览器在主线程再次解码整张 base64；
  // 外部 URL 则等 getBlobUrlAsync 原样返回后立即显示
  const isDataUrl = !!block.src && block.src.startsWith('data:');
  const imageSrc = bypassLazy || inView
    ? (isDataUrl ? (blobUrl ?? undefined) : (blobUrl || block.src))
    : undefined;

  return (
    <img
      ref={ref as React.Ref<HTMLImageElement>}
      src={imageSrc}
      alt={block.alt || ''}
      referrerPolicy="no-referrer"
      decoding="async"
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
  <blockquote dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }} />
));

const ListBlockComponent = React.memo<{ block: ListBlock }>(({ block }) => {
  const Tag = block.listType === 'ordered' ? 'ol' : 'ul';
  return (
    <Tag>
      {block.items.map((item, i) => (
        <li key={i} dangerouslySetInnerHTML={{ __html: sanitizeHtml(item) }} />
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
            <td key={j} dangerouslySetInnerHTML={{ __html: sanitizeHtml(cell) }} />
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

const RawHtmlBlockComponent = React.memo<{ block: RawHtmlBlock }>(({ block }) => {
  // 系统自生成的 HTML（知识图谱等）跳过净化，否则 iframe/script 会被剥离
  const sanitized = isSelfGeneratedHtmlCached(block.html)
    ? block.html
    : sanitizeHtml(block.html);
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
});

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
      // 顶层无 pdfData 时给出占位提示，避免 PDF 块静默消失
      return (
        <div style={{ margin: '1rem 0', padding: '12px 16px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b', fontSize: '13px' }}>
          📄 PDF 附件（详见文章页尾附件区）
        </div>
      );
    case 'rawHtml':
      return <RawHtmlBlockComponent block={block} />;
    default:
      return null;
  }
});
