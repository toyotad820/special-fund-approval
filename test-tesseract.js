import Tesseract from 'tesseract.js';
import fs from 'fs';
import path from 'path';

async function testTesseract(imagePath) {
  console.log(`測試圖片：${imagePath}`);

  try {
    const result = await Tesseract.recognize(
      imagePath,
      'chi_tra', // 繁體中文
      {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`進度: ${Math.round(m.progress * 100)}%`);
          }
        },
      }
    );

    console.log('\n=== Tesseract 辨識結果 ===');
    console.log(result.data.text);

    // 提取關鍵欄位
    const text = result.data.text;
    console.log('\n=== 關鍵欄位提取 ===');

    // 訂單編號（D開頭 13碼）
    const dataNoMatch = text.match(/D\d{12}/);
    console.log('訂單編號:', dataNoMatch ? dataNoMatch[0] : '未找到');

    // 所別（D開頭）
    const storeMatch = text.match(/所別位置|廠位置.*?(D\d{2})/);
    console.log('所別:', storeMatch ? storeMatch[1] : '未找到');

    // 客戶名稱
    const customerMatch = text.match(/客戶名稱[：:]\s*(.+?)[\n]|客戶名稱[：:]\s*(.+)$/m);
    console.log('客戶名稱:', customerMatch ? (customerMatch[1] || customerMatch[2]) : '未找到');

    // 車名
    const carMatch = text.match(/車名[：:]\s*(.+?)[\n]/);
    console.log('車名:', carMatch ? carMatch[1] : '未找到');

  } catch (error) {
    console.error('辨識失敗:', error.message);
  }
}

// 使用方法：node test-tesseract.js <圖片路徑>
const imagePath = process.argv[2];
if (!imagePath) {
  console.log('用法: node test-tesseract.js <圖片路徑>');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`檔案不存在: ${imagePath}`);
  process.exit(1);
}

testTesseract(imagePath);
