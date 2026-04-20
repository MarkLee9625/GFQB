import React from 'react';
import { Page, View, Text, Image } from '@react-pdf/renderer';
import { Article } from '../../../types/models';
import styles from './pdfStyles';

interface CoverProps {
  article: Article;
  useAlternateDesign?: boolean;
}

const Cover: React.FC<CoverProps> = ({ article, useAlternateDesign = false }) => {
  const issueText = article.issueText || 'NO.01';
  const dateText = article.dateText || 'JAN 2025';

  if (useAlternateDesign) {
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

export default Cover;
