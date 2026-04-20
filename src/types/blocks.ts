export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'blockquote'
  | 'list'
  | 'table'
  | 'code'
  | 'hr'
  | 'figure'
  | 'rawHtml';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type ListType = 'ordered' | 'unordered';

export interface TextBlock {
  id: string;
  type: 'paragraph';
  content: string;
}

export interface HeadingBlock {
  id: string;
  type: 'heading';
  level: HeadingLevel;
  content: string;
}

export interface ImageBlock {
  id: string;
  type: 'image';
  src: string;
  alt?: string;
  caption?: string;
}

export interface VideoBlock {
  id: string;
  type: 'video';
  src: string;
}

export interface AudioBlock {
  id: string;
  type: 'audio';
  src: string;
}

export interface PdfBlock {
  id: string;
  type: 'pdf';
  src: string;
}

export interface BlockquoteBlock {
  id: string;
  type: 'blockquote';
  content: string;
}

export interface ListBlock {
  id: string;
  type: 'list';
  listType: ListType;
  items: string[];
}

export interface TableBlock {
  id: string;
  type: 'table';
  rows: string[][];
}

export interface CodeBlock {
  id: string;
  type: 'code';
  content: string;
  language?: string;
}

export interface HrBlock {
  id: string;
  type: 'hr';
}

export interface FigureBlock {
  id: string;
  type: 'figure';
  image: Omit<ImageBlock, 'id' | 'type'>;
  caption?: string;
}

export interface RawHtmlBlock {
  id: string;
  type: 'rawHtml';
  html: string;
}

export type ContentBlock =
  | TextBlock
  | HeadingBlock
  | ImageBlock
  | VideoBlock
  | AudioBlock
  | PdfBlock
  | BlockquoteBlock
  | ListBlock
  | TableBlock
  | CodeBlock
  | HrBlock
  | FigureBlock
  | RawHtmlBlock;
