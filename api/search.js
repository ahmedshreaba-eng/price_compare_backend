const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// مفتاح SerpApi - هنحطه بشكل آمن بعدين، دلوقتي بس للتجربة
const SERPAPI_KEY = process.env.SERPAPI_KEY;
const IMGBB_KEY = process.env.IMGBB_KEY;

// Endpoint البحث الرئيسي
app.get('/api/search', async (req, res) => {
  const query = req.query.q; // اسم المنتج أو الباركود

  if (!query) {
    return res.status(400).json({ error: 'الرجاء إدخال اسم المنتج أو الباركود' });
  }

  try {
    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_shopping',
        q: query,
        api_key: SERPAPI_KEY,
        gl: 'ae', // نتائج مخصصة للإمارات
        hl: 'ar',
      },
    });

    const results = response.data.shopping_results || [];

    // تنظيم النتائج بشكل مبسط للتطبيق
    const formattedResults = results.slice(0, 15).map((item) => ({
      title: item.title,
      price: item.price,
      source: item.source,
      link: item.product_link || item.link || null,
      productId: item.product_id || null,
      thumbnail: item.thumbnail,
      rating: item.rating || null,
    }));

    res.json({
      query: query,
      count: formattedResults.length,
      results: formattedResults,
    });
  } catch (error) {
    console.error('SerpApi Error:', error.message);
    res.status(500).json({ error: 'حدث خطأ أثناء البحث، حاول مرة أخرى' });
  }
});
// Endpoint البحث بالصورة
app.post('/api/search-image', async (req, res) => {
  const { imageBase64 } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'الرجاء إرسال صورة' });
  }

  try {
    // الخطوة 1: رفع الصورة على imgbb للحصول على رابط
    const uploadResponse = await axios.post(
      `https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`,
      new URLSearchParams({ image: imageBase64 }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const imageUrl = uploadResponse.data.data.url;

    // الخطوة 2: البحث بالصورة عن طريق Google Lens في SerpApi
    const searchResponse = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_lens',
        url: imageUrl,
        api_key: SERPAPI_KEY,
        hl: 'ar',
      },
    });

    const exactMatches = searchResponse.data.exact_matches || [];
    const visualMatches = searchResponse.data.visual_matches || [];

    // نفضّل النتائج المطابقة فعلياً، ولو مفيش نرجع للنتائج الشبيهة بصرياً
    const matches = exactMatches.length > 0 ? exactMatches : visualMatches;

    const formattedResults = matches.slice(0, 15).map((item) => ({
      title: item.title,
      price: item.price?.value || 'السعر غير متاح',
      source: item.source,
      link: item.link,
      thumbnail: item.thumbnail,
      rating: null,
    }));

    res.json({
      count: formattedResults.length,
      results: formattedResults,
    });
  } catch (error) {
    console.error('Image Search Error:', error.message);
    res.status(500).json({ error: 'حدث خطأ أثناء البحث بالصورة، حاول مرة أخرى' });
  }
});
// Endpoint لجلب الرابط المباشر للمتجر
app.get('/api/product-link', async (req, res) => {
  const productId = req.query.id;

  if (!productId) {
    return res.status(400).json({ error: 'معرف المنتج مطلوب' });
  }

  try {
    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_product',
        product_id: productId,
        api_key: SERPAPI_KEY,
        gl: 'ae',
        hl: 'ar',
      },
    });

    const sellers = response.data.sellers_results?.online_sellers || [];
    const directLink = sellers.length > 0 ? sellers[0].link : null;

    res.json({ link: directLink });
  } catch (error) {
    console.error('Product Link Error:', error.message);
    res.status(500).json({ error: 'تعذر جلب الرابط المباشر' });
  }
});
// Endpoint تجريبي للتأكد إن السيرفر شغال
app.get('/', (req, res) => {
  res.json({ status: 'السيرفر شغال بنجاح ✅' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`السيرفر شغال على البورت ${PORT}`);
});

module.exports = app;