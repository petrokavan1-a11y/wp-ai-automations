export default async ({ req, res, log, error }) => {
  try {
    const payload = JSON.parse(req.payload);
    const { post_id, title, raw_notes, type, brand } = payload;

    if (!post_id || !title) {
      return res.json({ success: false, error: 'Missing required fields' }, 400);
    }

    // پرامپت دقیق و جامع بر اساس تمام جزئیات، استایل‌ها و قوانین تمپلیت تخصصی تجهیزات ایمنی پتروکاوان
    const prompt = `
تو یک متخصص ارشد سئو و بازاریابی دیجیتال در حوزه تجهیزات ایمنی صنعتی (B2B و B2C) برای سایت "پتروکاوان" هستی.
اطلاعات محصول زیر به تو داده شده است:
- نام محصول: ${title}
- برند: ${brand || 'پتروکاوان / متفرقه'}
- نکات و توضیحات اولیه: ${raw_notes || ''}

لطفاً محتوای این صفحه را با رعایت دقیق اصول زیر تولید کن و خروجی را فقط در قالب یک شیء JSON با کلیدهای زیر برگردان:

1. "seo_title": یک تایتل جذاب سئو شده (شامل نام برند فارسی/انگلیسی، کاربرد اصلی و کلمات تراکنشی).
2. "meta_description": توضیحات متا سئو جذاب و ترغیب‌کننده برای رنک‌مث.
3. "focus_keyword": کلمه کلیدی اصلی (دقیقاً ترکیب برند + مدل + نام محصول جهت جلوگیری از تداخل معنایی).
4. "url_slug": آدرس URL انگلیسی استاندارد بدون کاراکتر فارسی (فقط انگلیسی با خط تیره، مثلاً brand-model-product).
5. "short_description": توضیحات کوتاه HTML فروش‌محور و جذاب (همراه با تگ‌های پاراگراف و استایل‌های استاندارد).
6. "full_description": توضیحات کامل و جامع محصول به صورت HTML که شامل موارد زیر است:
   - هدینگ‌های H2 بهینه‌شده با تراز متن مناسب.
   - جدول‌های مشخصات فنی و کاربردها حتماً با این ساختار واکنش‌گرا و استایل‌دهی دقیق:
     <div class="table-responsive" style="overflow-x: auto; width: 100%; margin: 30px 0;">
       <table style="background-color: #f9f9f9; border: 1px solid #ddd; margin: 30px auto; width: 90%; border-collapse: collapse;">
         <thead>
           <tr style="background-color: #f48026; color: white;">
             <th style="border: 1px solid #ddd; padding: 10px; text-align: center;">ستون اول</th>
             <th style="border: 1px solid #ddd; padding: 10px; text-align: center;">ستون دوم</th>
           </tr>
         </thead>
         <tbody>
           <tr>
             <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">مقدار</td>
             <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">مقدار</td>
           </tr>
         </tbody>
       </table>
     </div>
   - رعایت شرایط لحن (B2B رسمی و مبتنی بر استانداردها یا B2C ترغیب‌کننده).
   - تحلیل استانداردهای ایمنی (مانند ATEX، CE، NIOSH و غیره در صورت نیاز).
   - پرهیز از تگ‌های خالی یا &nbsp; برای فاصله و استفاده از مارجین‌های CSS.
7. "tags": برچسب‌های استاندارد جدا شده با کامای انگلیسی (مناسب برای کپی‌پست در وردپرس).
8. "faqs": سوالات متداول به صورت متن ساده (خط اول سوال، خط دوم جواب).
`;

    // ارسال درخواست به OpenRouter (هوش مصنوعی)
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

    // آماده‌سازی پِی‌لود جهت ارسال به وردپرس/ووکامرس
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

    // ارسال به وردپرس از طریق REST API
    const endpoint = type === 'product' 
      ? `${siteUrl}/wp-json/wp/v2/products/${post_id}`
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

    return res.json({ success: true, message: 'Template content generated and synced successfully' });

  } catch (err) {
    error(err.message);
    return res.json({ success: false, error: err.message }, 500);
  }
};
