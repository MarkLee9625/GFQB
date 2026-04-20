import React from 'react';
import { Document } from '@react-pdf/renderer';
import { Article } from '../../../types/models';
import Cover from './PdfCover';
import TOC from './PdfTOC';
import ArticlePage from './PdfArticlePage';
import BackCover from './PdfBackCover';
import './pdfStyles';

interface MyDocumentProps {
  articles: Article[];
  options?: {
    useAlternateDesign?: boolean;
    logo?: string;
  };
}

const MyDocument: React.FC<MyDocumentProps> = ({ articles, options }) => {
  const { useAlternateDesign = false, logo = '' } = options || {};
  
  const sortedArticles = [...articles].sort((a, b) => {
    if (a.category === '封面') return -1;
    if (b.category === '封面') return 1;
    if (a.category === '封底') return 1;
    if (b.category === '封底') return -1;
    return (Number(a.order) || 0) - (Number(b.order) || 0);
  });

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
