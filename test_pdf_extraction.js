// 测试PDF摘要提取功能
import { testPdfExtraction } from './services/pdfExtractor.js';

// 一个简单的base64测试数据（实际上是一个文本文件的base64编码）
const testPdfBase64 = 'data:application/pdf;base64,' + btoa('摘要：这是一个测试摘要。这是一个用于测试PDF摘要提取功能的示例文本。关键词：测试，摘要，提取。引言：这是测试的开始部分。');

console.log('开始测试PDF摘要提取功能...');

try {
  const result = await testPdfExtraction(testPdfBase64);
  console.log('测试结果:', JSON.stringify(result, null, 2));
  
  if (result.success) {
    console.log('✅ PDF摘要提取测试通过！');
    console.log('提取到的摘要:', result.abstract);
  } else {
    console.log('❌ PDF摘要提取测试失败！');
    console.log('错误信息:', result.error);
  }
} catch (error) {
  console.error('测试过程中发生错误:', error);
}
