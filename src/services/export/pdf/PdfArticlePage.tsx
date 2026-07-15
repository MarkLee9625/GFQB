import React from 'react';
import { Page, View, Text, Image } from '@react-pdf/renderer';
import { Html } from 'react-pdf-html';
import type { Article } from '../../../types';
import styles from './pdfStyles';

interface ArticlePageProps {
  article: Article;
  logo?: string;
}

const ArticlePage: React.FC<ArticlePageProps> = ({ article, logo }) => {
  const tags = article.tags || [];

  return (
    <Page size="A4" style={styles.articlePage}>
      <View style={styles.articleHeader}>
        <Text style={styles.articleTitle}>{article.title}</Text>
        <View style={styles.articleMeta}>
          {tags.length > 0 && (
            <View style={styles.tagCloud}>
              {tags.map((tag, idx) => (
                <Text key={idx} style={styles.tagItem}>
                  {tag}
                </Text>
              ))}
            </View>
          )}
          <Text style={styles.articleCategory}>分类: {article.category}</Text>
        </View>
      </View>

      {article.abstract && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>摘要</Text>
          <Text style={styles.summaryText}>{article.abstract}</Text>
        </View>
      )}

      <View style={styles.articleContent}>
        {article.content ? (
          <Html
            style={{ 
              fontFamily: 'NotoSansSC', 
              fontSize: 12, 
              color: '#1F2937' 
            }}
            stylesheet={{
              p: { fontFamily: 'NotoSansSC', marginBottom: 12, lineHeight: 1.8 },
              div: { fontFamily: 'NotoSansSC' },
              span: { fontFamily: 'NotoSansSC' },
              li: { fontFamily: 'NotoSansSC', marginBottom: 4 },
              ul: { fontFamily: 'NotoSansSC', marginBottom: 12 },
              ol: { fontFamily: 'NotoSansSC', marginBottom: 12 },
              h1: { fontFamily: 'NotoSansSC', fontWeight: 'bold', fontSize: 24, marginBottom: 12 },
              h2: { fontFamily: 'NotoSansSC', fontWeight: 'bold', fontSize: 20, marginBottom: 10 },
              h3: { fontFamily: 'NotoSansSC', fontWeight: 'bold', fontSize: 16, marginBottom: 8 },
              h4: { fontFamily: 'NotoSansSC', fontWeight: 'bold', fontSize: 14, marginBottom: 6 },
              strong: { fontFamily: 'NotoSansSC', fontWeight: 'bold' },
              em: { fontFamily: 'NotoSansSC', fontStyle: 'italic' },
              table: { fontFamily: 'NotoSansSC', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 },
              tr: { fontFamily: 'NotoSansSC' },
              td: { fontFamily: 'NotoSansSC', padding: 4 },
              th: { fontFamily: 'NotoSansSC', fontWeight: 'bold', padding: 4 },
              a: { fontFamily: 'NotoSansSC', color: '#005596', textDecoration: 'none' },
              img: { maxWidth: '100%', objectFit: 'contain', marginVertical: 10, alignSelf: 'center' }
            }}
          >
            {article.content}
          </Html>
        ) : (
          <Text style={{ color: '#9CA3AF', fontStyle: 'italic' }}>
            本文暂无内容
          </Text>
        )}
      </View>

      <View style={styles.articleFooter}>
        {logo && <Image src={logo} style={styles.footerLogo} />}
        <Text style={styles.footerText}>SWS KNOWLEDGE BASE</Text>
      </View>
      <Text style={styles.articleEndMark}>- End of Article -</Text>
    </Page>
  );
};

export default ArticlePage;
