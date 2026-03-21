import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
  Image,
  Link,
} from '@react-pdf/renderer';
import { Html } from 'react-pdf-html';
import { Article, CONSTANTS } from '../../../types';

// 注册中文字体
Font.register({
  family: 'NotoSansSC',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/notosanssc/v36/k3kXo84MPvpLmixcA63oeAL9LP3A.woff2',
      fontWeight: 400,
    },
    {
      src: 'https://fonts.gstatic.com/s/notosanssc/v36/k3kXo84MPvpLmixcA63oeAL9LP3A.woff2',
      fontWeight: 700,
    },
  ],
});

// 创建样式
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 0,
    fontFamily: 'NotoSansSC',
  },
  coverPage: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  coverBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#F8F9FA',
  },
  coverHeader: {
    marginTop: 80,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  coverTitle: {
    fontSize: 60,
    fontWeight: 'bold',
    color: '#005596',
    letterSpacing: 10,
    marginBottom: 20,
  },
  coverSubtitle: {
    fontSize: 18,
    color: '#666666',
    marginBottom: 30,
    letterSpacing: 2,
  },
  coverMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  coverMetaBadge: {
    backgroundColor: '#005596',
    color: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 15,
    fontSize: 14,
    fontWeight: 'bold',
  },
  coverMetaDivider: {
    color: '#00559680',
    fontSize: 12,
  },
  coverImageContainer: {
    flex: 1,
    marginHorizontal: 40,
    marginTop: 40,
    marginBottom: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    width: '100%',
    maxHeight: 400,
    objectFit: 'contain',
  },
  coverFooter: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  coverFooterText: {
    fontSize: 14,
    color: '#666666',
    letterSpacing: 2,
  },
  tocPage: {
    padding: 60,
  },
  tocHeader: {
    alignItems: 'center',
    marginBottom: 50,
  },
  tocTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#005596',
    marginBottom: 10,
  },
  tocSubtitle: {
    fontSize: 12,
    color: '#666666',
    letterSpacing: 2,
  },
  tocList: {
    width: '100%',
  },
  tocItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 10,
  },
  tocItemTitle: {
    fontSize: 16,
    color: '#1F2937',
    flex: 1,
  },
  tocDots: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
    borderBottomStyle: 'dotted',
    marginHorizontal: 10,
    marginBottom: 4,
  },
  tocPageNumber: {
    fontSize: 16,
    color: '#005596',
    fontWeight: 'bold',
  },
  articlePage: {
    padding: 60,
  },
  articleHeader: {
    marginBottom: 30,
  },
  articleTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 10,
  },
  articleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 20,
  },
  tagCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagItem: {
    backgroundColor: '#E5E7EB',
    color: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
  },
  articleCategory: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryCard: {
    backgroundColor: '#F3F4F6',
    padding: 20,
    borderRadius: 8,
    marginBottom: 30,
    borderLeftWidth: 5,
    borderLeftColor: '#005596',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 1.7,
    color: '#374151',
  },
  articleContent: {
    fontSize: 16,
    lineHeight: 2.0,
    color: '#1F2937',
    textAlign: 'justify',
  },
  articleFooter: {
    marginTop: 50,
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerLogo: {
    width: 120,
    height: 'auto',
    marginBottom: 10,
  },
  footerText: {
    fontSize: 12,
    color: '#6B7280',
    letterSpacing: 2,
  },
  articleEndMark: {
    marginTop: 30,
    textAlign: 'center',
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  backCoverPage: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: '100%',
    position: 'relative',
    padding: 60,
  },
  backCoverHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  backCoverTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#005596',
    marginBottom: 10,
  },
  backCoverSubtitle: {
    fontSize: 18,
    color: '#666666',
  },
  backCoverImageContainer: {
    flex: 1,
    marginVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backCoverImage: {
    width: '80%',
    maxHeight: 300,
    objectFit: 'contain',
  },
  backCoverFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  backCoverCompany: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  backCoverAddress: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 1.5,
  },
  backCoverLogo: {
    width: 100,
    height: 'auto',
  },
});

// 封面组件
interface CoverProps {
  article: Article;
  useAlternateDesign?: boolean;
}

const Cover: React.FC<CoverProps> = ({ article, useAlternateDesign = false }) => {
  const issueText = article.issueText || 'NO.01';
  const dateText = article.dateText || 'JAN 2025';

  if (useAlternateDesign) {
    // 杂志风格封面
    return (
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverBackground} />
        <View style={styles.coverHeader}>
          <Text style={styles.coverSubtitle}>SHIP CONSTRUCTION METHOD</Text>
          <Text style={styles.coverTitle}>工法情报</Text>
          <View style={styles.coverMetaContainer}>
            <Text style={styles.coverMetaBadge}>{issueText}</Text>
            <Text style={styles.coverMetaDivider}>•</Text>
            <Text style={styles.coverMetaBadge}>{dateText}</Text>
          </View>
        </View>
        <View style={styles.coverImageContainer}>
          {article.coverImage ? (
            <Image src={article.coverImage} style={styles.coverImage} />
          ) : (
            <Text style={{ color: '#999999', fontSize: 16 }}>暂无封面图片</Text>
          )}
        </View>
        <View style={styles.coverFooter}>
          <Text style={styles.coverFooterText}>OFFICIAL PUBLICATION</Text>
        </View>
      </Page>
    );
  }

  // 原版设计封面
  return (
    <Page size="A4" style={styles.coverPage}>
      <View style={styles.coverBackground} />
      <View style={styles.coverHeader}>
        <Text style={styles.coverSubtitle}>Ship Construction Method Information</Text>
        <Text style={styles.coverTitle}>工法情报</Text>
        <View style={styles.coverMetaContainer}>
          <Text style={{ ...styles.coverMetaBadge, backgroundColor: 'transparent', color: '#005596' }}>
            {issueText}
          </Text>
          <Text style={styles.coverMetaDivider}>·</Text>
          <Text style={{ ...styles.coverMetaBadge, backgroundColor: 'transparent', color: '#005596' }}>
            {dateText}
          </Text>
        </View>
      </View>
      <View style={styles.coverImageContainer}>
        {article.coverImage ? (
          <Image src={article.coverImage} style={styles.coverImage} />
        ) : (
          <Text style={{ color: '#999999', fontSize: 16 }}>暂无封面图片</Text>
        )}
      </View>
      <View style={styles.coverFooter}>
        <View style={{ height: 15, width: 80, backgroundColor: '#333333', opacity: 0.4 }} />
      </View>
    </Page>
  );
};

// 目录组件
interface TOCProps {
  articles: Article[];
}

const TOC: React.FC<TOCProps> = ({ articles }) => {
  // 过滤出正文文章（非封面封底）
  const contentArticles = articles.filter(
    (article) => article.category !== '封面' && article.category !== '封底'
  );

  return (
    <Page size="A4" style={styles.tocPage}>
      <View style={styles.tocHeader}>
        <Text style={styles.tocTitle}>目 录</Text>
        <Text style={styles.tocSubtitle}>CONTENTS</Text>
      </View>
      <View style={styles.tocList}>
        {contentArticles.map((article, index) => (
          <View key={article.id} style={styles.tocItem}>
            <Text style={styles.tocItemTitle}>{article.title}</Text>
            <View style={styles.tocDots} />
            <Text style={styles.tocPageNumber}>{index + 1}</Text>
          </View>
        ))}
      </View>
    </Page>
  );
};

// 文章组件
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

// 封底组件
interface BackCoverProps {
  article: Article;
  useAlternateDesign?: boolean;
  logo?: string;
}

const BackCover: React.FC<BackCoverProps> = ({ article, useAlternateDesign = false, logo }) => {
  const company = CONSTANTS.COMPANY_INFO;

  if (useAlternateDesign) {
    // 杂志风格封底
    return (
      <Page size="A4" style={styles.backCoverPage}>
        <View style={styles.backCoverHeader}>
          <Text style={styles.backCoverSubtitle}>SHIP CONSTRUCTION METHOD</Text>
          <Text style={styles.backCoverTitle}>Sailing With Success</Text>
        </View>
        <View style={styles.backCoverImageContainer}>
          {article.backImage ? (
            <Image src={article.backImage} style={styles.backCoverImage} />
          ) : (
            <Text style={{ color: '#999999', fontSize: 16 }}>暂无封底图片</Text>
          )}
        </View>
        <View style={styles.backCoverFooter}>
          <View>
            <Text style={styles.backCoverCompany}>{company.EN_SHORT}</Text>
            <Text style={styles.backCoverAddress}>
              {company.EN_FULL}
              {'\n'}
              {company.ZH_FULL}
            </Text>
          </View>
          <View>
            {logo && <Image src={logo} style={styles.backCoverLogo} />}
            <Text style={{ fontSize: 10, color: '#6B7280', marginTop: 5 }}>
              Official Publication
              {'\n'}
              Volume {article.issueText || '01'} · {article.dateText || 'JAN 2025'}
            </Text>
          </View>
        </View>
      </Page>
    );
  }

  // 原版设计封底
  return (
    <Page size="A4" style={styles.backCoverPage}>
      <View style={styles.backCoverHeader}>
        <Text style={styles.backCoverSubtitle}>Ship Construction Method Information</Text>
        <Text style={styles.backCoverTitle}>Sailing With Success</Text>
      </View>
      <View style={styles.backCoverImageContainer}>
        {article.backImage ? (
          <Image src={article.backImage} style={styles.backCoverImage} />
        ) : (
          <Text style={{ color: '#999999', fontSize: 16 }}>暂无封底图片</Text>
        )}
      </View>
      <View style={styles.backCoverFooter}>
        <View>
          <Text style={styles.backCoverCompany}>{company.EN_SHORT}</Text>
          <Text style={styles.backCoverAddress}>{company.ZH_FULL}</Text>
        </View>
        {logo && <Image src={logo} style={styles.backCoverLogo} />}
      </View>
    </Page>
  );
};

// 主文档组件
interface MyDocumentProps {
  articles: Article[];
  options?: {
    useAlternateDesign?: boolean;
    logo?: string;
  };
}

const MyDocument: React.FC<MyDocumentProps> = ({ articles, options }) => {
  const { useAlternateDesign = false, logo = '' } = options || {};
  
  // 按类别排序：封面 -> 正文 -> 封底
  const sortedArticles = [...articles].sort((a, b) => {
    if (a.category === '封面') return -1;
    if (b.category === '封面') return 1;
    if (a.category === '封底') return 1;
    if (b.category === '封底') return -1;
    return 0;
  });

  // 找出封面、封底和正文
  const coverArticle = sortedArticles.find((article) => article.category === '封面');
  const backCoverArticle = sortedArticles.find((article) => article.category === '封底');
  const contentArticles = sortedArticles.filter(
    (article) => article.category !== '封面' && article.category !== '封底'
  );

  return (
    <Document>
      {/* 封面 */}
      {coverArticle && (
        <Cover article={coverArticle} useAlternateDesign={useAlternateDesign} />
      )}

      {/* 目录 */}
      {contentArticles.length > 0 && <TOC articles={sortedArticles} />}

      {/* 正文文章 */}
      {contentArticles.map((article) => (
        <ArticlePage key={article.id} article={article} logo={logo} />
      ))}

      {/* 封底 */}
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