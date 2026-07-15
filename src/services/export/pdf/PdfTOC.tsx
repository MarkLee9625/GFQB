import React from 'react';
import { Page, View, Text } from '@react-pdf/renderer';
import type { Article } from '../../../types';
import styles from './pdfStyles';

interface TOCProps {
  articles: Article[];
}

const TOC: React.FC<TOCProps> = ({ articles }) => {
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

export default TOC;
