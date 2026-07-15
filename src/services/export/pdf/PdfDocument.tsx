import React from 'react';
import { Document } from '@react-pdf/renderer';
import type { Article } from '../../../types';
import Cover from './PdfCover';
import TOC from './PdfTOC';
import ArticlePage from './PdfArticlePage';
import BackCover from './PdfBackCover';
import './pdfStyles';
import { sortArticlesByPriority } from '../../../utils/articleSort';

interface MyDocumentProps {
  articles: Article[];
  options?: {
    useAlternateDesign?: boolean;
    logo?: string;
  };
}

const MyDocument: React.FC<MyDocumentProps> = ({ articles, options }) => {
  const { useAlternateDesign = false, logo = '' } = options || {};
  
  const sortedArticles = sortArticlesByPriority(articles);

  const coverArticle = sortedArticles.find((article) => article.category === '封面');
  const backCoverArticle = sortedArticles.find((article) => article.category === '封底');
  const contentArticles = sortedArticles.filter(
    (article) => article.category !== '封面' && article.category !== '封底'
  );

  return (
    <Document>
      {coverArticle && (
        <Cover article={coverArticle} useAlternateDesign={useAlternateDesign} />
      )}

      {contentArticles.length > 0 && <TOC articles={sortedArticles} />}

      {contentArticles.map((article) => (
        <ArticlePage key={article.id} article={article} logo={logo} />
      ))}

      {backCoverArticle && (
        <BackCover
          article={backCoverArticle}
          useAlternateDesign={useAlternateDesign}
          logo={logo}
        />
      )}
    </Document>
  );
};

export { MyDocument, Cover, TOC, ArticlePage, BackCover };
export default MyDocument;
