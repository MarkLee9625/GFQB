import React from 'react';
import { Page, View, Text, Image } from '@react-pdf/renderer';
import { Article } from '../../../types/models';
import { CONSTANTS } from '../../../constants';
import styles from './pdfStyles';

interface BackCoverProps {
  article: Article;
  useAlternateDesign?: boolean;
  logo?: string;
}

const BackCover: React.FC<BackCoverProps> = ({ article, useAlternateDesign = false, logo }) => {
  const company = CONSTANTS.COMPANY_INFO;

  if (useAlternateDesign) {
    return (
      <Page size="A4" style={styles.backCoverPage}>
        {article.backImage && (
          <View style={styles.coverImageContainer}>
            <Image src={article.backImage} style={styles.coverImage} />
          </View>
        )}
        <View style={styles.coverOverlay} />
        <View style={styles.coverHeader}>
          <Text style={styles.backCoverSubtitle}>SHIP CONSTRUCTION METHOD</Text>
          <Text style={styles.backCoverTitle}>Sailing With Success</Text>
        </View>
        <View style={styles.backCoverFooter}>
          <View>
            <Text style={styles.backCoverCompany}>{company.EN_SHORT}</Text>
            <Text style={styles.backCoverAddress}>
              {company.EN_FULL}{'\n'}{company.ZH_FULL}
            </Text>
          </View>
          <View>
            {logo && <Image src={logo} style={styles.backCoverLogo} />}
            <Text style={{ fontSize: 10, color: 'rgba(0,85,150,0.5)', marginTop: 5 }}>
              Official Publication{'\n'}Volume {article.issueText || '01'} · {article.dateText || 'JAN 2025'}
            </Text>
          </View>
        </View>
      </Page>
    );
  }

  return (
    <Page size="A4" style={styles.backCoverPage}>
      {article.backImage && (
        <View style={styles.coverImageContainer}>
          <Image src={article.backImage} style={styles.coverImage} />
        </View>
      )}
      <View style={styles.coverOverlay} />
      <View style={styles.coverHeader}>
        <Text style={styles.backCoverSubtitle}>Ship Construction Method Information</Text>
        <Text style={styles.backCoverTitle}>Sailing With Success</Text>
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

export default BackCover;
