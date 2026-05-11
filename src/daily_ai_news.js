const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Parser = require('rss-parser');

// ========== 配置 ==========

const HN_TOP_STORIES = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const HN_ITEM = (id) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
const HN_LINK = (id) => `https://news.ycombinator.com/item?id=${id}`;
// Google News RSS — 中文 AI 资讯（稳定可靠）
const GOOGLE_NEWS_AI_ZH = 'https://news.google.com/rss/search?q=人工智能+大模型+AI&hl=zh-CN&gl=CN&ceid=CN:zh-Hans';
// 36氪官方 RSS
const RSS36KR = 'https://36kr.com/feed';
// Reddit 机器学习社区
const REDDIT_ML_RSS = 'https://www.reddit.com/r/MachineLearning/.rss';
const MYMEMORY_API = 'https://api.mymemory.translated.net/get';

// 浏览器 UA，避免被反爬拦截
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

const AI_KEYWORDS = [
    // 英文关键词
    'ai', 'artificial intelligence', 'llm', 'large language model', 'gpt', 'openai', 'chatgpt',
    'claude', 'anthropic', 'gemini', 'deepmind', 'machine learning', 'deep learning',
    'neural network', 'transformer', 'diffusion', 'stable diffusion', 'midjourney', 'dalle',
    'copilot', 'langchain', 'llama', 'mistral', 'grok', 'qwen', 'deepseek',
    'pre-train', 'fine-tune', 'rlhf', 'agent', 'multimodal', 'rag', 'vector database',
    'embedding', 'nlp', 'instruct', 'foundation model', 'sft', 'lora', 'qlora',
    'cursor', 'windsurf', 'codex', 'sora', 'suno', 'whisper', 'text-to-video',
    'text-to-image', 'video generation', 'image generation', 'synthetic data',
    // 中文关键词
    '人工智能', '大模型', '机器学习', '深度学习', '文心一言', '通义千问', '智谱',
    '百川', '月之暗面', 'moonshot', 'kimi', '零一万物', 'minimax', '阶跃星辰',
    '豆包', '混元', '商汤', '日日新', '讯飞星火', '盘古', '天工',
    '具身智能', '人形机器人', '自动驾驶', '智能体'
];

const SOURCE_CONFIG = {
    'Hacker News': {color: '#ff6600', maxItems: 15},
    'Google News AI': {color: '#4285f4', maxItems: 12},
    '36氪': {color: '#00b96b', maxItems: 10},
    'Reddit ML': {color: '#ff4500', maxItems: 10},
};

// ========== 工具函数 ==========

function hasChinese(text) {
    return /[一-鿿㐀-䶿]/.test(text);
}

function normalizeTitle(title) {
    return title
        .toLowerCase()
        .replace(/[^\w一-鿿\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function matchesAiKeyword(title) {
    const lower = title.toLowerCase();
    return AI_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

async function translateIfNeeded(text) {
    if (hasChinese(text)) return text;
    try {
        const params = new URLSearchParams({q: text, langpair: 'en|zh-CN'});
        const res = await fetch(`${MYMEMORY_API}?${params}`, {
            signal: AbortSignal.timeout(8000),
        });
        const data = await res.json();
        const translated = data?.responseData?.translatedText;
        return translated && translated !== text ? translated : text;
    } catch {
        return text; // 翻译失败保留原文
    }
}

async function translateBatch(articles) {
    const results = [];
    for (let i = 0; i < articles.length; i += 3) {
        const batch = articles.slice(i, i + 3).map(async (a) => {
            a.title = await translateIfNeeded(a.title);
            return a;
        });
        results.push(...await Promise.all(batch));
        if (i + 3 < articles.length) {
            await new Promise(r => setTimeout(r, 300));
        }
    }
    return results;
}

function deduplicate(articles) {
    const seen = new Map();
    for (const a of articles) {
        const norm = normalizeTitle(a.title);
        const hash = crypto.createHash('md5').update(norm).digest('hex');
        const existing = seen.get(hash);
        if (!existing || a.title.length > existing.title.length) {
            seen.set(hash, a);
        }
    }
    return [...seen.values()];
}

function beijingDateStr() {
    const now = new Date(new Date().toLocaleString('en-US', {timeZone: 'Asia/Shanghai'}));
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ========== 抓取函数 ==========

async function fetchHackerNewsArticles() {
    console.log('[HN] 正在获取热门文章列表...');
    const idsRes = await fetch(HN_TOP_STORIES, {
        signal: AbortSignal.timeout(10000),
    });
    const ids = await idsRes.json();
    console.log(`[HN] 获取到 ${ids.length} 个热门文章 ID`);

    // 取前 60 篇热门文章，拉取详情
    const topIds = ids.slice(0, 60);
    const items = await Promise.allSettled(
        topIds.map((id) =>
            fetch(HN_ITEM(id), {signal: AbortSignal.timeout(10000)})
                .then(r => r.json())
        )
    );

    const stories = [];
    for (const result of items) {
        if (result.status !== 'fulfilled') continue;
        const item = result.value;
        if (item.type !== 'story' || !item.title) continue;
        if (!matchesAiKeyword(item.title)) continue;

        const link = item.url || HN_LINK(item.id);
        stories.push({
            title: item.title,
            link,
            source: 'Hacker News',
            time: new Date(item.time * 1000).toISOString(),
        });
    }

    console.log(`[HN] 过滤后得到 ${stories.length} 篇 AI 相关文章`);
    return stories;
}

async function fetchRssArticles(url, sourceName) {
    console.log(`[${sourceName}] 正在获取 RSS...`);

    const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: {
            'User-Agent': BROWSER_UA,
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xml = await response.text();

    // 先用 rss-parser 解析；如果 XML 格式有问题则用正则兜底提取
    let items = [];
    try {
        const parser = new Parser();
        const feed = await parser.parseString(xml);
        items = feed.items || [];
        console.log(`[${sourceName}] rss-parser 解析到 ${items.length} 条`);
    } catch (parseErr) {
        console.log(`[${sourceName}] rss-parser 解析失败 (${parseErr.message})，使用正则兜底提取...`);
        // 调试：打印 XML 前段便于排查格式
        console.log(`[${sourceName}] === XML 前 800 字符 ===`);
        console.log(xml.slice(0, 800));
        console.log(`[${sourceName}] === XML 预览结束 ===`);
        items = parseRssWithRegex(xml);
        console.log(`[${sourceName}] 正则兜底提取到 ${items.length} 条`);
    }

    const articles = [];
    for (const item of items) {
        if (!item.title) continue;
        if (!matchesAiKeyword(item.title)) continue;
        articles.push({
            title: item.title,
            link: item.link || '',
            source: sourceName,
            time: item.pubDate || item.isoDate || '',
        });
    }

    console.log(`[${sourceName}] 过滤后得到 ${articles.length} 篇 AI 相关文章`);
    return articles;
}

// 正则兜底：当 RSS XML 格式不规范时，从 <item> 或 <entry> 中提取字段
function parseRssWithRegex(xml) {
    // 检测是 RSS 还是 Atom
    const useEntry = xml.includes('<entry>') || xml.includes('<entry ');
    const tag = useEntry ? 'entry' : 'item';
    const itemBlocks = xml.split(new RegExp(`<${tag}[^>]*>`, 'i')).slice(1);
    const items = [];

    for (const block of itemBlocks) {
        const endIdx = block.lastIndexOf(`</${tag}>`);
        const content = endIdx > 0 ? block.slice(0, endIdx) : block;

        // 提取标题（处理 CDATA 和纯文本两种情况）
        const titleMatch = content.match(/<title[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/title>/i);
        const rawTitle = titleMatch ? (titleMatch[1] || titleMatch[2]).trim() : null;
        if (!rawTitle) continue;
        // 解码 HTML 实体
        const title = rawTitle
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

        // 提取链接
        let link = '';
        const linkMatch = content.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
        if (linkMatch) {
            link = linkMatch[1].trim();
        } else {
            // Atom: <link href="..." />
            const linkHref = content.match(/<link[^>]*href="([^"]*)"[^>]*\/?>/i);
            if (linkHref) link = linkHref[1].trim();
        }

        // 提取日期
        let pubDate = '';
        const dateMatch = content.match(/<pubDate[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/pubDate>/i)
            || content.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i)
            || content.match(/<published[^>]*>([\s\S]*?)<\/published>/i)
            || content.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
        if (dateMatch) {
            pubDate = (dateMatch[1] || dateMatch[2] || dateMatch[3] || dateMatch[4] || '').trim();
        }

        items.push({title, link, pubDate});
    }

    return items;
}

// ========== 邮件构建 ==========

function buildHtmlEmail(articlesBySource, totalCount) {
    const dateStr = beijingDateStr();

    let sectionsHtml = '';
    for (const [source, articles] of Object.entries(articlesBySource)) {
        const config = SOURCE_CONFIG[source] || {color: '#666', maxItems: Infinity};
        const displayArticles = articles.slice(0, config.maxItems);

        let itemsHtml = '';
        displayArticles.forEach((a, i) => {
            itemsHtml += `
                <tr>
                    <td style="padding: 6px 0; vertical-align: top; color: #999; font-size: 13px; width: 24px;">${i + 1}.</td>
                    <td style="padding: 6px 0; vertical-align: top;">
                        <a href="${escapeHtml(a.link)}" target="_blank" style="color: #2c3e50; text-decoration: none; font-size: 15px; line-height: 1.5;">
                            ${escapeHtml(a.title)}
                        </a>
                    </td>
                </tr>`;
        });

        sectionsHtml += `
            <div style="margin-bottom: 24px;">
                <div style="display: inline-block; background: ${config.color}; color: #fff; padding: 4px 14px; border-radius: 4px; font-size: 13px; font-weight: 600; margin-bottom: 10px;">
                    ${escapeHtml(source)} · ${displayArticles.length} 条
                </div>
                <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                    ${itemsHtml}
                </table>
            </div>`;
    }

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #f5f7fa; margin: 0; padding: 20px;">
    <div style="max-width: 680px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">

        <!-- 头部 -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px 28px; text-align: center;">
            <h1 style="color: #fff; font-size: 22px; margin: 0; font-weight: 700;">每日 AI 资讯汇总</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">
                ${dateStr}（北京时间） · 共 ${totalCount} 条
            </p>
        </div>

        <!-- 资讯列表 -->
        <div style="padding: 24px 28px;">
            ${sectionsHtml}
        </div>

        <!-- 底部 -->
        <div style="background: #fafafa; padding: 16px 28px; text-align: center; border-top: 1px solid #eee;">
            <p style="color: #bbb; font-size: 12px; margin: 0;">
                由 GitHub Actions 自动生成 · 每日 10:00（北京时间）发送
            </p>
            <p style="color: #ccc; font-size: 11px; margin: 4px 0 0;">
                资讯来源：Hacker News · Google News · 36氪 · Reddit ML
            </p>
        </div>

    </div>
</body>
</html>`;
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ========== 邮件发送 ==========

async function sendEmail(html, totalCount) {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    const to = process.env.EMAIL_TO;
    console.log(user, pass, to)

    if (!user || !pass) {
        console.error('邮件凭据未配置：请设置 EMAIL_USER 和 EMAIL_PASS 环境变量');
        return;
    }
    if (!to) {
        console.error('收件地址未配置：请设置 EMAIL_TO 环境变量');
        return;
    }

    const dateStr = beijingDateStr();
    const transporter = nodemailer.createTransport({
        host: 'smtp.qq.com',
        port: 465,
        secure: true,
        auth: {user, pass},
    });

    await transporter.sendMail({
        from: `"AI资讯机器人" <${user}>`,
        to,
        subject: `每日 AI 资讯汇总 - ${dateStr}（${totalCount}条）`,
        html,
    });

    console.log(`邮件发送成功 → ${to}`);
}

// ========== 主流程 ==========

async function main() {
    console.log('========== 每日 AI 资讯抓取开始 ==========');

    // 1. 并行抓取四个来源
    const [hnR, gnewsR, kr36R, redditR] = await Promise.allSettled([
        fetchHackerNewsArticles(),
        fetchRssArticles(GOOGLE_NEWS_AI_ZH, 'Google News AI'),
        fetchRssArticles(RSS36KR, '36氪'),
        fetchRssArticles(REDDIT_ML_RSS, 'Reddit ML'),
    ]);

    const allArticles = [];
    for (const [result, source] of [
        [hnR, 'Hacker News'],
        [gnewsR, 'Google News AI'],
        [kr36R, '36氪'],
        [redditR, 'Reddit ML'],
    ]) {
        if (result.status === 'fulfilled') {
            allArticles.push(...result.value);
        } else {
            console.error(`[${source}] 抓取失败:`, result.reason?.message || result.reason);
        }
    }

    console.log(`\n总计抓取 ${allArticles.length} 篇（去重前）`);

    if (allArticles.length === 0) {
        console.log('没有获取到任何资讯，跳过邮件发送');
        return;
    }

    // 2. 翻译英文标题
    console.log('正在翻译英文标题...');
    const translated = await translateBatch(allArticles);
    console.log('翻译完成');

    // 3. 去重
    const unique = deduplicate(translated);
    console.log(`去重后共 ${unique.length} 条资讯\n`);

    // 4. 按来源分组
    const bySource = {};
    for (const a of unique) {
        if (!bySource[a.source]) bySource[a.source] = [];
        bySource[a.source].push(a);
    }

    // 5. 构建邮件并发送
    const html = buildHtmlEmail(bySource, unique.length);
    await sendEmail(html, unique.length);

    console.log('========== 完成 ==========');
}

main().catch((err) => {
    console.error('脚本执行失败:', err);
    process.exit(1);
});
