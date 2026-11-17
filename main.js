export default async ({ req, res, log, error }) => {
  try {
    const payload = JSON.parse(req.payload);
    const { post_id, title, raw_notes, type, brand, category } = payload;

    if (!post_id || !title) {
      return res.json({ success: false, error: 'Missing required fields' }, 400);
    }

    // ۱. ساخت پرامپت پیشرفته بر اساس قالب تخصصی تجهیزات ایمنی شما
    const prompt = `
تو یک متخصص ارشد سئو و بازاریابی دیجیتال در حوزه تجهیزات ایمنی صنعتی (B2B و B2C) برای سایت "پتروکاوان" هستی.
محصولی با مشخصات زیر داریم:
- نام محصول: ${title}
- برند: ${brand || 'نامشخص'}
- اطلاعات اولیه و نکات: ${raw_notes || ''}

لطفاً اطلاعات این محصول را با دقت و کاملاً حرفه‌ای، بدون کدهای اضافی اضافی و دقیقاً در قالب یک شیء JSON با کلیدهای زیر تولید کن:

1. "seo_title": یک تایتل جذاب سئو شده (شامل برند فارسی و انگلیسی، کاربرد، و کلمات تراکنشی).
2. "meta_description": توضیحات متا سئو جذاب و ترغیب‌کننده.
3. "focus_keyword": کلمه کلیدی اصلی رنک‌مث (دقیقاً ترکیب برند + مدل + نام محصول).
4. "url_slug": آدرس URL انگلیسی استاندارد (فقط انگلیسی با خط تیره، مثلاً brand-model-product).
5. "short_description": توضیحات کوتاه HTML فروش‌محور و جذاب (مطابق با استانداردهای سئو و تگ‌های پاراگراف).
6. "full_description": توضیحات کامل و گسترده محصول به صورت HTML شامل:
   - هدینگ‌های H2 بهینه‌شده
   - جدول‌های مشخصات فنی و کاربردها با استایل دقیق (دارای ظرف واکنش‌گرا با overflow-x: auto، سطر اول نارنجی #f48026 با متن سفید، بدون پس‌زمینه و بدون بردر اضافی برای سایر سطرها).
   - نکات نگهداری، استانداردهای ایمنی (مثل ATEX، CE یا NIOSH در صورت نیاز).
7. "tags": برچسب‌های سئو شده جدا شده با کامای انگلیسی (مثلا: کلاه ایمنی, Centurion Vulcan, ...).
8. "faqs": سوالات متداول به صورت متن ساده (خط اول سوال، خط دوم جواب).
9. "attributes": ویژگی‌های ووکامرس برای فیلتر (به صورت ساختار نام=نامک).

پاسخ را فقط و فقط در قالب یک فرمت استاندارد JSON برگردان.
`;

    // ۲. ارسال درخواست به هوش مصنوعی (OpenRouter)
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const aiData = await aiRes.json();
    const generated = JSON.parse(aiData.choices[0].message.content);

    // ۳. آماده‌سازی پِی‌لود برای ارسال به وردپرس (ووکامرس)
    const siteUrl = process.env.WP_SITE_URL;
    const wpPayload = {
      title: title,
      slug: generated.url_slug,
      description: generated.full_description,
      short_description: generated.short_description,
      meta_data: [
        { key: 'rank_math_title', value: generated.seo_title },
        { key: 'rank_math_description', value: generated.meta_description },
        { key: 'rank_math_focus_keyword', value: generated.focus_keyword }
      ]
    };

    // ۴. ارسال درخواست به‌روزرسانی به ووکامرس / وردپرس از طریق REST API
    const endpoint = type === 'product' 
      ? `${siteUrl}/wp-json/wc/v3/products/${post_id}`
      : `${siteUrl}/wp-json/wp/v2/posts/${post_id}`;

    const wpResponse = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASS}`).toString('base64')
      },
      body: JSON.stringify(wpPayload)
    });

    if (!wpResponse.ok) {
      throw new Error(`WordPress API failed: ${await wpResponse.text()}`);
    }

    return res.json({ success: true, message: 'Template content generated and synced to WordPress successfully' });

  } catch (err) {
    error(err.message);
    return res.json({ success: false, error: err.message }, 500);
  }
};
