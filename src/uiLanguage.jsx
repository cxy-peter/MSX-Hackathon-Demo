import React, { useEffect, useMemo, useRef, useState } from 'react';

const UI_LANGUAGE_STORAGE_KEY = 'msx-ui-language';
const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label'];

const EN_TO_ZH = {
  'Back to welcome': '返回首页',
  'Connect MetaMask': '连接 MetaMask',
  'Connecting to MetaMask...': '正在连接 MetaMask...',
  'Connect wallet': '连接钱包',
  'Wallet connected': '钱包已连接',
  'Developer mode': '开发者模式',
  'What is it?': '这是什么？',
  'How this works': '说明',
  'How this works.': '说明。',
  'RiskLens Guided Investing Hub': 'RiskLens 引导式投资中心',
  'RiskLens Wealth Hub': 'RiskLens 财富中心',
  'RiskLens Paper Trading Replay Lab': 'RiskLens 模拟交易回放实验室',
  'RiskLens Hackathon Demo': 'RiskLens 黑客松演示',
  Welcome: '欢迎',
  Discover: '发现',
  Learn: '学习',
  Wealth: '理财',
  'Paper Trading': '模拟交易',
  'Remaining paper tokens': '剩余模拟代币',
  'Available PT balance': '可用 PT 余额',
  'Available replay cash': '可用回放资金',
  'Onboarding helper': '新手引导助手',
  'Recommended next step': '推荐下一步',
  'Best module to open': '最适合打开的模块',
  'Arrival routing': '进入路径',
  'Current route': '当前路径',
  'What RiskLens already has': 'RiskLens 已经具备',
  'What we are fixing': '我们正在修正',
  'Why this matters': '为什么这很重要',
  'Current direction': '当前方向',
  'Learn & earn': '学习与奖励',
  'Wallet tutorial': '钱包教程',
  'RiskLens + AI-guided discovery + wallet-native onboarding': 'RiskLens + AI 引导发现 + 钱包原生 onboarding',
  'Make RWA investing understandable before it feels onchain.': '在接触链上之前，先把 RWA 投资讲明白。',
  'This version keeps the RiskLens welcome-page aesthetic, but upgrades the wallet entry into a real MetaMask connection flow that can be deployed to GitHub Pages and tested directly by judges.':
    '这个版本保留了 RiskLens 欢迎页的视觉风格，同时把钱包入口升级为真实的 MetaMask 连接流程，可部署到 GitHub Pages 并供评委直接测试。',
  'First-time users see purpose, not jargon': '让第一次使用的用户先看到用途，而不是术语',
  'Wallet connection feels like a real product flow': '钱包连接更像真实产品流程',
  'Explore starter products': '查看入门产品',
  'No wallet? We can help you!': '还没有钱包？我们可以帮你！',
  'What is blocking you right now?': '你现在最大的卡点是什么？',
  'I am new here and do not know where to start': '我是新手，不知道该从哪里开始',
  'I do not understand contracts or onchain rights': '我不理解合约或链上权利',
  'I want to know which products are safer for beginners': '我想知道哪些产品更适合新手',
  'Are you coming from a Web2 or Web3 mindset?': '你现在更接近 Web2 还是 Web3 的使用心态？',
  'I am from Web2': '我是从 Web2 过来的',
  'I want plain-language routes, simpler products, and simulated practice before anything feels technical.':
    '我想先看更直白的路径、更简单的产品，以及在任何技术内容之前先做模拟练习。',
  'I am from Web3': '我是从 Web3 过来的',
  'I already know wallets and may want to skip beginner setup if the product path is obvious enough.':
    '我已经了解钱包，如果产品路径足够清晰，我可能想跳过新手设置。',
  'Which path feels more comfortable right now?': '你现在更想走哪条路径？',
  'OK, show me what to do': '好，告诉我该怎么做',
  'Show me what to do': '告诉我该怎么做',
  'We first learn whether this user wants a guided step-by-step route or would rather begin with simpler wealth products.':
    '我们先判断这个用户是想要引导式的分步路径，还是更愿意从更简单的理财产品开始。',
  'Great. We will guide this user through wallet setup, badge tasks, and then unlock paper trading in a cleaner order.':
    '很好。我们会先带这个用户完成钱包设置和徽章任务，再按更清晰的顺序解锁模拟交易。',
  'Start wallet tasks': '开始钱包任务',
  'See paper trading': '查看模拟交易',
  'Start with the guided wallet path, then unlock paper trading after the onboarding steps.':
    '先走引导式钱包路径，再在完成 onboarding 后解锁模拟交易。',
  'I feel a bit cautious about investing': '我对投资还有些谨慎',
  'No problem. We also provide wealth products with simpler framing before moving into more active flows.':
    '没问题。我们也提供表达更简单的理财产品，再逐步进入更主动的流程。',
  'Do you want to skip the beginner wallet tutorial?': '你想跳过新手钱包教程吗？',
  'Yes, skip to practice': '是的，直接进入练习',
  'Unlock paper trading immediately and jump into simulation without the onboarding loop.':
    '立即解锁模拟交易，跳过 onboarding 直接进入模拟。',
  'No, keep the wallet guide': '不要，保留钱包引导',
  'Keep paper trading locked for now, explain wallets first, and only unlock practice after the beginner route is clear.':
    '先保持模拟交易锁定，先解释钱包，再在新手路径清晰后解锁练习。',
  'Paper trading unlock.': '模拟交易已解锁。',
  'The user can now enter simulation mode and test products before any live-style action.':
    '用户现在可以进入模拟模式，在任何真实风格操作前先测试产品。',
  'Tokenized stock story, stablecoin entry, and a finance-first brand shell.': '代币化股票叙事、稳定币入口，以及偏金融导向的品牌外壳。',
  'Beginner routing, clearer discovery cards, and a wallet flow that behaves like a live product.':
    '新手路径、更清晰的发现卡片，以及更像真实产品的钱包流程。',
  'Judges should be able to click one link and immediately feel the interaction model.':
    '评委应该点开一个链接，就能立刻感受到整体交互模型。',
  'RiskLens-style welcome page with real MetaMask connection, then guided product discovery.':
    'RiskLens 风格欢迎页 + 真实 MetaMask 连接，再进入引导式产品发现。',
  'Ask one question before showing the full product stack': '在展示完整产品堆栈前，先问一个问题',
  'Start as a beginner, not as a trader': '先像新手一样开始，而不是直接像交易员那样操作',
  'RiskLens should first explain what a product is for, show a simple 1,000 USDT example, and then route users into practice instead of forcing live complexity too early.':
    'RiskLens 应该先解释产品是做什么的，用一个简单的 1,000 USDT 例子讲清楚，再把用户引导进练习，而不是过早地强行进入真实复杂流程。',
  'Review starter products first, then try one paper trade.': '先看入门产品，再尝试一笔模拟交易。',
  'Review the reserve and strategy product briefings first, then try one paper trade.':
    '先查看储备类和策略类产品简报，再尝试一笔模拟交易。',
  'Explore product lanes': '探索产品路径',
  'Start here for the real MetaMask flow.': '从这里开始真实的 MetaMask 流程。',
  'Submit one Sepolia action after connect.': '连接后提交一次 Sepolia 操作。',
  'Congrats - welcome badge finished. The wallet task claim is open now.':
    '恭喜，欢迎徽章已完成。现在可以领取钱包任务徽章。',
  'Quest Detail': '任务详情',
  'Optional Detail': '可选模块详情',
  'Review any 4 live product briefings from the current Wealth and Paper lanes.':
    '从当前理财与模拟交易路径里查看任意 4 个实时产品简报。',
  'Check ownership, return source, and first disclosure for one real product lane.':
    '检查一个真实产品路径里的持有什么、收益来源和第一条披露。',
  'Unlock depends on wallet, welcome mint, and product-briefing review.':
    '解锁取决于钱包连接、欢迎徽章铸造和产品简报查看。',
  'Beginner note: after a badge is minted, look for it in the connected wallet collectibles / NFT view. The demo state and the collectible should use the same wallet account.':
    '新手提示：徽章铸造后，可以在已连接钱包的收藏品 / NFT 视图里查看。演示状态和收藏品应使用同一个钱包账户。',
  'Briefing card': '简报卡片',
  'Explain-it-back checkpoint': '复述检查点',
  'What should the user hear first?': '用户第一句话应该听到什么？',
  'It is a tokenized fund share with NAV and redemption rules.': '它是带净值和赎回规则的代币化基金份额。',
  'It behaves like unrestricted cash with no gating or settlement steps.':
    '它像不受限制的现金，没有门槛或结算步骤。',
  'The main attraction is directional upside if risk assets rally.': '主要吸引力是风险资产上涨时的方向性收益。',
  'Goal-based wealth hub for users who need explanation before yield':
    '面向需要先理解再看收益的用户的目标型理财中心',
  'Wealth path': '理财路径',
  'Fit first, receipt second, diligence always visible': '先看适配，再看凭证，尽调始终可见',
  'The wealth page now behaves like a guided product surface: it starts from a user goal, keeps ownership language visible, and only then opens the signed receipt flow.':
    '理财页现在像一个引导式产品界面：先从用户目标出发，持续展示“持有什么”的语言，然后才打开签署凭证流程。',
  'Wallet-linked demo receipts': '钱包绑定演示凭证',
  'Demo only': '仅演示',
  Routing: '路径',
  Ownership: '所有权',
  'Research layer': '研究层',
  'Goal-first product routing': '目标优先的产品路由',
  'Start from the user goal like stable yield, steadier principal, or buy-lower exposure, then reveal the product structure only after the fit is clear.':
    '先从稳定收益、更稳本金或逢低买入敞口这类用户目标出发，等适配关系清楚后再展示产品结构。',
  'Users see fit first, structure second.': '用户先看到适配，再看到结构。',
  'Subscriptions now map to wallet-linked share tokens, so the wealth page can show ownership, redemption rights, and future reward or gating logic.':
    '认购现在会映射为钱包绑定份额代币，因此理财页可以展示所有权、赎回权，以及未来奖励或门槛逻辑。',
  'AI diligence and compliance layer': 'AI 尽调与合规层',
  'Each shelf can explain underlying assets, source of return, eligibility, liquidity stress, and disclosure posture instead of hiding behind APY alone.':
    '每个货架都能解释底层资产、收益来源、适格性、流动性压力和披露姿态，而不是只躲在 APY 后面。',
  'Open wealth hub': '打开理财中心',
  'Simulation mode should sit directly under discovery': '模拟模式应该直接接在发现之后',
  'Paper trading unlock': '模拟交易解锁',
  'Remaining tokens': '剩余代币',
  'Reward per badge': '每枚徽章奖励',
  'Minimum trade size': '最低交易金额',
  'Replay entry': '回放入口',
  'Starter simulation': '入门模拟',
  'Practice with treasury-style or managed products before using any live wallet flow. Badge rewards increase the available simulation budget.':
    '在使用任何真实风格钱包流程前，先用国债类或托管类产品练习。徽章奖励会提高可用模拟预算。',
  'Budget expands as homepage badges are completed.': '主页徽章完成后，模拟预算会增加。',
  'Education state': '学习状态',
  'Product briefings already reviewed': '产品简报已查看',
  'This wallet already completed the product-briefing prerequisite, so paper trading can focus on actual simulation instead of first-pass education.':
    '这个钱包已经完成产品简报前置条件，因此模拟交易可以专注实际模拟，而不是第一遍教育。',
  'Open replay lab': '打开回放实验室',
  'Mint paper trading task badge': '铸造模拟交易任务徽章',
  'After the three onboarding prerequisites are finished, this paper trading preview can mint its own badge for the current wallet.':
    '三个 onboarding 前置条件完成后，该模拟交易预览可以为当前钱包铸造自己的徽章。',
  'Optional modules': '可选模块',
  'These can be opened in any order after the core wallet path starts.': '核心钱包路径启动后，这些模块可以按任意顺序打开。',
  'Wallet task completed': '钱包任务已完成',
  'Connect once with MetaMask to unlock this task. After the welcome badge is minted in step 2, this wallet task can claim its own badge and keep the reward state.':
    '先用 MetaMask 连接一次来解锁这个任务。在第 2 步铸造欢迎徽章后，这个钱包任务就可以领取自己的徽章并保留奖励状态。',
  'Open MetaMask connect': '打开 MetaMask 连接',
  'Connect wallet badge': '连接钱包徽章',
  'Mint wallet task badge': '铸造钱包任务徽章',
  'This task badge opens only after the welcome badge is minted. Finish step 2 first, then mint the wallet-task collectible for this account.':
    '这个任务徽章只有在欢迎徽章铸造后才会开放。先完成步骤 2，再为当前账户铸造钱包任务收藏品。',
  'Goal-first wealth': '目标优先理财',
  'Show values': '显示数值',
  'Hide values': '隐藏数值',
  'Goal-based routing': '基于目标的路径',
  'RWA and quant shelves': 'RWA 与量化货架',
  'AI diligence layer': 'AI 尽调层',
  'Tokenized share receipts': '代币化份额凭证',
  'Build a clearer RWA and wealth shelf before asking users to trade.': '在要求用户交易之前，先把 RWA 与理财货架讲清楚。',
  'This wealth page borrows the shelf logic from large CEX earn products, but adapts it for RiskLens: explain the underlying, show the source of return, attach wallet-native share receipts, and gate advanced products with risk and quiz progress instead of hiding everything behind strategy jargon.':
    '这个理财页借鉴了大型 CEX Earn 产品的货架逻辑，但针对 RiskLens 做了调整：解释底层、展示收益来源、附上钱包原生份额凭证，并通过风险与测验进度来解锁高级产品，而不是把一切都藏在策略术语后面。',
  'Total invested': '总投入',
  'Total return': '总收益',
  'Portfolio annual yield': '组合年化收益',
  'Fixed term': '固定期限',
  'Flexible / weekly': '灵活 / 周期性',
  'Strategy sleeves': '策略仓位',
  'Structured sleeves': '结构化仓位',
  'Wallet milestones': '钱包里程碑',
  'Bonus buying power': '额外购买力',
  'Approx.': '约',
  'Share-token NAV minus principal deployed.': '份额代币净值减去投入本金。',
  "Weighted by current sleeve value and each product&apos;s displayed annual-yield basis.": '按当前仓位价值和每个产品显示的年化收益基础加权。',
  "Weighted by current sleeve value and each product's displayed annual-yield basis.": '按当前仓位价值和每个产品显示的年化收益基础加权。',
  'Entry routing': '进入路径',
  'Start from the user goal, then reveal the product structure': '先从用户目标出发，再展开产品结构',
  'Recommended for this goal:': '这个目标下推荐：',
  'Product shelf': '产品货架',
  'Search any fund you know': '搜索你熟悉的基金',
  'Search product shelf': '搜索产品货架',
  'Keep principal steadier': '尽量让本金更稳',
  'Start with real treasury-style products where the yield source, access rules, and redemption terms are easiest to explain.':
    '先从真实的 treasury 风格产品开始，因为它们的收益来源、准入规则和赎回条款最容易解释。',
  'Earn stable yield': '获取稳定收益',
  'Compare treasury, money fund, and private-credit style products by net take-home yield instead of headline APY alone.':
    '用最终到手净收益来比较 treasury、货币基金和私募信贷风格产品，而不是只看 headline APY。',
  'Compare treasury, money fund, and private-credit style products by net take-home value instead of headline APY alone.':
    '用最终到手净值来比较 treasury、货币基金和私募信贷风格产品，而不是只看 headline APY。',
  'headline APY alone.': '标题 APY。',
  'treasury-style sleeves': 'treasury 风格仓位',
  'Wait before deploying': '先等一等再部署',
  'Park into redeemable treasury-style sleeves when you want yield now but still want the option to rotate later.':
    '如果你现在想先拿收益、但之后还想保留轮动空间，可以先停在可赎回的 treasury 风格仓位里。',
  'Wait and buy lower': '等待更低价格再买入',
  'Use structured payouts only when you are comfortable with conditional settlement and maturity-driven outcomes.':
    '只有在你能接受条件结算和到期结果驱动时，再使用结构化收益产品。',
  'Position for upside': '为上涨留出仓位',
  'Focus on products whose return depends on active positioning, credit selection, or conditional entry rather than simple cash yield.':
    '关注那些收益依赖主动仓位、信用选择或条件入场，而不是简单现金收益的产品。',
  'Focus on a product whose return depends on active positioning, credit selection, or manager execution rather than simple cash yield.':
    '聚焦那些收益依赖主动仓位、信用选择或管理人执行，而不是单纯现金收益的产品。',
  'Focus on products whose return depends on active positioning, credit selection, or manager execution rather than simple cash yield.':
    '聚焦那些收益依赖主动仓位、信用选择或管理人执行，而不是单纯现金收益的产品。',
  'Focus on a product whose': '聚焦那些',
  'return depends on active positioning, credit selection,': '收益依赖主动仓位、信用选择，',
  'or manager execution rather than': '或管理人执行，而不是',
  'simple cash yield.': '单纯现金收益。',
  'Higher income normally means': '更高收益通常意味着',
  'more credit, basis, liquidity,': '更多信用、基差、流动性，',
  'or settlement complexity.': '或结算复杂度。',
  'Higher income normally means more credit, basis, liquidity, or settlement complexity.':
    '更高收益通常意味着更多信用、基差、流动性或结算复杂度。',
  'The product page should make that tradeoff visible.':
    '产品页应该把这种权衡直接讲清楚。',
  'Take more risk for more yield': '承担更多风险来争取更高收益',
  'More income usually means more credit, basis, liquidity, or settlement complexity. The product page should make that tradeoff visible.':
    '更高收益通常意味着更多信用、基差、流动性或结算复杂度。产品页应该把这种权衡直接讲清楚。',
  'All shelves': '全部货架',
  'Starter yield': '入门收益',
  'Strategy / fund': '策略 / 基金',
  'Open-ended': '开放式',
  'Closed-ended': '封闭式',
  'Open-ended sleeves': '开放式仓位',
  'Closed-ended sleeves': '封闭式仓位',
  'Subscription and access': '认购与准入',
  'No products matched that keyword': '没有产品匹配这个关键词',
  'Try a product name, ticker-style token, underlying asset, or a fund family keyword like treasury, income, credit, or structured.':
    '可以试试产品名、类似 ticker 的代币名、底层资产，或者 treasury、income、credit、structured 这类基金家族关键词。',
  'Selected detail is expanded below.': '已在下方展开详情。',
  Completed: '已完成',
  completed: '已完成',
  Done: '已就绪',
  done: '已完成',
  Checking: '检查中',
  Unlocked: '已解锁',
  Minted: '已铸造',
  'Task guide': '任务引导',
  'wealth task guide': '理财任务引导',
  'Follow one guided path, then buy every product through the same receipt flow':
    '沿着一条引导路径走完，然后所有产品都通过同一套凭证流程购买',
  complete: '完成',
  'Next task:': '下一步任务：',
  'Receipt live': '凭证已生效',
  'Receipt mint': '铸造凭证',
  'Buy one receipt': '购买一张凭证',
  'Choose a product, open the lifecycle desk, review the buy flow, then mint a local receipt balance in the wealth ledger.':
    '选择一个产品，打开生命周期操作台，检查买入流程，然后在理财账本里铸造本地凭证余额。',
  'Settle / pledge': '结算 / 质押',
  'Simulate settle or pledge': '模拟结算或质押',
  'Settle means close, redeem, roll, or mature the receipt. Pledge means locking it as route support before release.':
    '结算指关闭、赎回、展期或到期处理凭证。质押指先把凭证锁定为路线支持，再释放。',
  'This is the main wealth learning loop: pick a product for a goal, read the fit and diligence context, then sign a simulated subscription that mints a receipt in the local wallet ledger.':
    '这是理财页的主要学习循环：先按目标挑产品，阅读适配性和尽调信息，再签署模拟认购，在本地钱包账本里铸造凭证。',
  'How to clear it': '如何完成',
  GO: '去做',
  'Start from a goal like earn so the shelf already narrows into a clearer lane.':
    '先从“赚取收益”这类目标开始，让货架自动收窄到更清晰的方向。',
  'Open RiskLens Quant Fund #2 or any product card and review the flow, rights, and diligence pages before subscribing.':
    '打开 RiskLens Quant Fund #2 或任意产品卡，在认购前查看流程、权利和尽调页面。',
  'Use the lifecycle desk to sign the demo subscription so the wallet ends up with a visible receipt position.':
    '用生命周期操作台签署演示认购，让钱包里出现可见的凭证仓位。',
  'Review AI recommendation': '查看 AI 推荐',
  'Wallet-linked badge carry-over': '钱包绑定徽章继承',
  'Welcome badge: Minted': '欢迎徽章：已铸造',
  'Briefing badge: Ready or minted': '简报徽章：可领取或已铸造',
  'Quiz badge: Ready or minted': '测验徽章：可领取或已铸造',
  'Beginner note: when a homepage badge is minted, look for it in the connected wallet collectibles / NFT view. Wealth keeps reading the same wallet-linked progress.':
    '新手提示：主页徽章铸造后，可以在已连接钱包的收藏品 / NFT 视图里查看。理财页会继续读取同一个钱包进度。',
  'Product types': '产品类型',
  'Choose the product wrapper first': '先选择产品包装类型',
  'Hover for the long explanation': '悬停查看完整解释',
  'All product types': '全部产品类型',
  'Cash & Treasury': '现金与国债',
  'Managed Strategy': '托管策略',
  Recommended: '推荐',
  'Click any card to open detail': '点击任意卡片打开详情',
  'Fits this wallet because': '适合这个钱包，因为',
  'Signals used: wallet connection, homepage learning, quiz, paper trading, flash-style sophistication, collateral, and prior settlement activity when available.':
    '使用的信号：钱包连接、主页学习、测验、模拟交易、类闪电贷复杂度、抵押品，以及可用时的历史结算活动。',
  'Open detail': '打开详情',
  'My wealth positions': '我的理财仓位',
  'Wallet-linked vault holdings': '钱包绑定金库持仓',
  'Reset wealth demo': '重置理财演示',
  'Recent wallet activity': '最近钱包活动',
  'Latest signed actions': '最新签署操作',
  'productized as a buyable wealth receipt, not as a raw strategy terminal.':
    '被产品化为可购买的理财凭证，而不是原始策略终端。',
  'Static demo snapshot': '静态演示快照',
  'What you own': '你持有什么',
  'Return source': '收益来源',
  Liquidity: '流动性',
  'Main risk': '主要风险',
  Rights: '权利',
  'Modeled premium': '模型化权利金',
  'Modeled premium basis': '模型化权利金基础',
  'Outcome cap': '结果上限',
  'Modeled outcome cap': '模型化结果上限',
  'Modeled income': '模型化收入',
  'Modeled option-premium income': '模型化期权权利金收入',
  'Conditional coupon': '条件票息',
  'Modeled conditional coupon': '模型化条件票息',
  'Base asset': '基础资产',
  Hard: '较难',
  'This is closer to a conditional BTC order with premium than a savings product. The important question is what asset you may receive at settlement.':
    '这更像带权利金的条件式 BTC 订单，而不是储蓄产品。关键问题是结算时你可能收到哪种资产。',
  'This is for learning a protected-growth style payoff: you can participate in some ETH upside, but you trade away flexibility and some upside for a defined outcome.':
    '这是用来学习保护型成长收益结构的：你可以参与部分 ETH 上涨，但会用灵活性和部分上涨空间换取明确结果。',
  'This is not regular interest. You are earning a modeled premium for accepting capped upside, downside exposure, and monthly settlement timing.':
    '这不是普通利息。你获得的是模型化权利金，代价是接受上涨封顶、下行敞口和月度结算节奏。',
  'Capped upside': '封顶上涨空间',
  'capped upside': '封顶上涨空间',
  'Capital gains and losses from listed-equity or ETF exposure.':
    '来自上市股票或 ETF 敞口的资本收益和亏损。',
  'Capital gains and losses': '资本收益和亏损',
  'Use this when the user understands the target price and is comfortable ending the week with either ETH or USDC.':
    '当用户理解目标价，并能接受本周结束时持有 ETH 或 USDC 任一结果时，才适合使用。',
  'This is the higher-volatility teaching version: the premium is larger, but so is the chance that settlement asset surprises the user.':
    '这是更高波动的教学版本：权利金更高，但结算资产让用户意外的概率也更高。',
  'This is a timeline product. You watch observation dates and coupon conditions, then settle when the note calls or matures.':
    '这是时间线型产品。你需要关注观察日和票息条件，然后在票据自动赎回或到期时结算。',
  'Click this product to view details, read AI diligence, then buy or pledge from the detail page.':
    '点击该产品查看详情、阅读 AI 尽调，然后在详情页购买或质押。',
  'Wallet owns': '钱包持有',
  Pledged: '已质押',
  'Selected product': '已选产品',
  'Latest NAV': '最新净值',
  'Min ticket': '最低申购',
  Available: '可用',
  'Detail focus': '详情焦点',
  'Buy / settle / pledge': '买入 / 结算 / 质押',
  Overview: '概览',
  Timeline: '时间线',
  'AI Diligence': 'AI 尽调',
  'What to do here. Use this after reading the overview and AI diligence. Buy, settlement, rollover, transfer, and pledge all live in the same lifecycle desk.':
    '这里用来执行下一步。阅读概览和 AI 尽调后，在同一个生命周期操作台里完成买入、结算、展期、转让和质押。',
  'Buy, hold, and exit flow': '买入、持有与退出流程',
  'Subscribe amount': '认购金额',
  'Current shares': '当前份额',
  'Current value': '当前价值',
  'Free to redeem': '可赎回份额',
  'Pledged shares': '已质押份额',
  'Route support': '路线支持额度',
  'Redemption / settlement timing': '赎回 / 结算时间',
  'Maturity or event only': '仅到期或事件触发',
  '7-day target-price settlement. No ordinary early redemption in this beginner flow.':
    '7 天目标价结算。该新手流程不提供普通提前赎回。',
  'No early redeem': '不可提前赎回',
  'Review and buy': '检查并买入',
  Reset: '重置',
  'Settlement desk': '结算操作台',
  'Settlement action': '结算操作',
  'Settle into PT cash': '结算为 PT 现金',
  'Transfer target': '转入目标',
  'Projected NAV': '预计净值',
  'Free receipt value': '可用凭证价值',
  'Projected gain': '预计收益',
  'Sign settlement action': '签署结算操作',
  'Pledge support': '质押支持',
  'Use this receipt as collateral': '用该凭证作抵押',
  'Support line target': '支持额度目标',
  'Support target': '支持目标',
  'Collateral value': '抵押价值',
  'Max borrow': '最高借入',
  'Current LTV': '当前 LTV',
  'Pledge APY': '质押年化',
  'Open support line on': '开启支持额度：',
  'Release support': '释放支持',
  'Flexible support can release anytime. Fixed support uses the same timeline before release.':
    '灵活支持可随时释放；固定支持需要先走同一条时间线再释放。',
  'Release anytime': '随时释放',
  'Flexible': '灵活',
  'Release can be signed without waiting for the timeline.': '无需等待时间线即可签署释放。',
  'Return leaderboard': '收益排行榜',
  'Top 10 shelves by displayed yield, premium, coupon, or outcome metric. AI score stays beside each row so return never appears without diligence context.':
    '按展示收益、权利金、票息或结果指标排序的前 10 个货架。AI 分数始终在旁边，避免收益脱离尽调语境单独出现。',
  'Click any row to open that product and jump straight to its detail section. The sidebar stays focused on the top 10 instead of paging through the shelf.':
    '点击任意行即可打开该产品并跳到详情区。侧栏专注展示前 10 名，而不是翻完整个货架。',
  'Product compare': '产品对比',
  'Compare current product paths without squeezing the chart': '在不压缩图表的情况下对比当前产品路径',
  'Use current category set': '使用当前分类集合',
  'Compare window': '对比窗口',
  'Add product': '添加产品',
  'Choose a product': '选择产品',
  Remove: '移除',
  Latest: '最新',
  Rebased: '重设基准后',
  'Open support line': '开启支持额度',
  'Await wallet': '等待钱包确认',
  'Human mode': '人话模式',
  'Protocol mode': '协议模式',
  'Top 10 shelves by displayed annual yield. AI score stays beside each row so return never appears without diligence context.':
    '按展示年化收益排列的前 10 个货架。AI 分数会始终显示在每一行旁边，避免收益脱离尽调语境单独出现。',
  'This is a strong benchmark for a cash-management shelf: real short T-bills, low fee drag, and a tokenized share whose value climbs gradually instead of pretending to be insured cash.':
    '这是现金管理货架里很强的基准产品：真实的短期 T-bills、较低的费用拖累，以及一个会逐步升值而不是假装成受保存款的代币化份额。',
  'Open-ended shelves stay available without a separate closed-end pass.': '开放式货架无需额外的封闭式权限即可保持可用。',
  'This sleeve is closed-ended. It cannot be redeemed early in the current flow, so use the maturity preview instead.':
    '这个仓位是封闭式的。在当前流程里不能提前赎回，请改看 maturity 预览。',
  'Start with the amount, review the buy preview, then follow the exact exit path this product allows. Open-ended sleeves can redeem later; closed-ended sleeves wait for maturity.':
    '先输入金额，查看买入预览，再按照这个产品允许的退出路径操作。开放式仓位可以之后赎回；封闭式仓位则需要等待到期。',
  'Replay-first paper trading': '回放优先的模拟交易',
  'Reset replay lab': '重置回放实验室',
  'Practice RiskLens-style product decisions against historical replay bars before any live action.':
    '在任何真实操作之前，先用历史回放练习 RiskLens 风格的产品决策。',
  'This version turns paper trading into an explainable replay lab. You can compare RiskLens starter RWAs, tokenized stock wrappers, and common CEX assets inside one wallet-linked simulation surface, then step through history bar by bar to see what your decision would have done next.':
    '这个版本把模拟交易做成了一个可解释的回放实验室。你可以在同一个绑定钱包的模拟界面里，对比 RiskLens 入门 RWA、代币化股票包装以及常见 CEX 资产，然后逐根回放历史 K 线，看看你的决策接下来会发生什么。',
  'Historical replay': '历史回放',
  'Wallet-linked ledger': '钱包绑定账本',
  'RiskLens vs CEX comparison': 'RiskLens 与 CEX 对比',
  'Human / protocol explainers': '人话 / 协议解释',
  'Estimated account value': '预估账户价值',
  'Gross open PnL': '未实现毛收益',
  'Net open PnL': '未实现净收益',
  'Available cash plus estimated net exit value after carry drag, fees, and tax holdback.':
    '可用现金加上扣除持有成本、手续费和预估税费后的净退出价值。',
  'Pure price move before carry drag, fees, and estimated tax.': '仅看价格变化，不含持有成本、手续费和预估税费。',
  'Estimated net value if every open position exited at the current replay cursor.':
    '如果所有持仓都在当前回放位置卖出后的预估净值。',
  'How buying power works': '购买力如何计算',
  'Ranked by total replay return. Each wallet appears once using its best recorded result, and every confirmed local submission is merged into a device-local archive so other wallets stay on this board.':
    '按总回放收益排序。每个钱包只用最佳记录出现一次，每次确认的本地提交都会合并进设备本地档案，让其他钱包继续留在榜上。',
  'No submitted replay scores yet': '还没有提交的回放分数',
  'Finish one positive replay loop and submit the score on Sepolia to bring the leaderboard back to life.':
    '完成一次正收益回放闭环，并在 Sepolia 提交分数，让排行榜恢复活跃。',
  'Replay score is now tied to the same PnL bridge used in the desk: cumulative realized PnL from closed sells plus current open net PnL from any remaining positions.':
    '回放分数现在与操作台使用同一套 PnL 桥接：已平仓卖出的累计已实现 PnL，加上剩余持仓的当前未平仓净 PnL。',
  'Realized closed PnL:': '已平仓实现 PnL：',
  'Open net PnL:': '未平仓净 PnL：',
  'Replay score:': '回放分数：',
  'Use the same wallet that already completed onboarding, then finish at least one buy or sell replay trade in Paper Trading.':
    '使用已完成 onboarding 的同一个钱包，然后在模拟交易里至少完成一次回放买入或卖出。',
  'Buy / sell usage': '买入 / 卖出使用记录',
  'Base check': '基础检查',
  'Leaderboard usage': '排行榜使用记录',
  'Low-buy / high-sell': '低买 / 高卖',
  'Spot loop': '现货闭环',
  'Directional perp leg': '方向性合约腿',
  'Perp Leverage': '合约杠杆',
  'Hedge workflow': '对冲流程',
  'Protective Hedge': '保护性对冲',
  'Wait to be minted on Sepolia': '等待在 Sepolia 铸造',
  'Core progress': '核心进度',
  'All core checks above are already recognized for this wallet, so the replay badge is now ready to be minted.':
    '上面的核心检查已被该钱包识别，因此回放徽章现在可以铸造。',
  'Wait to be minted': '等待铸造',
  'Home-page onboarding inherited': '已继承主页 onboarding',
  'This wallet already matches the wallet task from the Home page, so the inheritance check is complete here.':
    '这个钱包已经匹配主页的钱包任务，因此这里的继承检查已完成。',
  USED: '已使用',
  OK: '完成',
  TODO: '待办',
  'This wallet already used at least one replay buy or sell action, so the replay surface is recognized as completed.':
    '这个钱包已至少使用过一次回放买入或卖出操作，因此回放界面已被识别为完成。',
  'This collectible unlocks as soon as every core checklist row above is completed for the same wallet.':
    '同一个钱包完成上方所有核心清单后，该收藏品就会解锁。',
  'Start from the asset layer, then move into the play layer':
    '先从资产层开始，再进入玩法层',
  'All risk': '全部风险',
  'low risk': '低风险',
  'medium risk': '中风险',
  'high risk': '高风险',
  risk: '风险',
  'All lockup': '全部锁定期',
  'Flexible exit': '灵活退出',
  'Can lock': '可锁定',
  'Replay shelf': '回放货架',
  'Want to learn more?': '想了解更多？',
  'hedge default': '默认对冲',
  'DIRECT hedge default': '直接持仓默认对冲',
  Crypto: '加密资产',
  'Active on replay desk': '已在回放操作台选中',
  '7D move': '7 日变化',
  'Exit / lockup': '退出 / 锁定',
  'T+0 / Direct market replay': 'T+0 / 直接市场回放',
  'Tutorial path': '教程路径',
  'BUY -> SELL': '买入 -> 卖出',
  'Click "Start case"': '点击“开始案例”',
  'Click "Stop day"': '点击“停止日”',
  'Click "Stop day" or the dock preset': '点击“停止日”或浮动栏预设',
  'Fees to auto-sell': '自动卖出费用',
  'Buy entry drag': '买入进场成本',
  'Venue, spread, FX, and routing cost paid when the base ticket opens.':
    '基础订单打开时支付的场地、点差、汇兑和路由成本。',
  'Carry while holding': '持有期间成本',
  'Carry accumulates over about 30D before auto-sell.': '自动卖出前大约 30 天会累计持有成本。',
  'Auto-sell drag': '自动卖出成本',
  'Shows once the replay has a forward exit bar.': '当回放存在未来退出 K 线时显示。',
  'Est. take-home': '预计到手',
  'Net preview after the current timed exit path, around 0 PT value.':
    '当前定时退出路径后的净额预览，约为 0 PT。',
  'Auto-sell is the cleanest way to compare headline price move versus real take-home after route drag.':
    '自动卖出是对比标题价格变化和扣除路由成本后真实到手金额的最清晰方式。',
  'Replay chart': '回放图表',
  'Asset layer': '资产层',
  'Own vs Synthetic': '真实持有 vs 合成敞口',
  'Direct spot exposure': '直接现货敞口',
  'Market exposure': '市场敞口',
  'Can Auto-Act': '可自动执行',
  'Alerts / DCA / rebalance': '提醒 / 定投 / 再平衡',
  Volume: '成交量',
  'Market cap': '市值',
  '1 hour': '1 小时',
  '6 hour': '6 小时',
  '1 day': '1 天',
  '2 weeks': '2 周',
  '1 month': '1 个月',
  '2 months': '2 个月',
  'Replay desk': '回放操作台',
  'Advanced on': '高级模式开启',
  'Route notes': '路线说明',
  'Practice examples': '练习案例',
  Stop: '停止',
  'Case days': '案例天数',
  'Start case': '开始案例',
  'Stop day': '停止日',
  'Available cash range': '可用现金范围',
  Suggested: '建议值',
  '1/4 size': '四分之一仓位',
  'Half size': '半仓',
  'Auto-sell after hold': '持有后自动卖出',
  'Holding period': '持有期',
  'Use the floating auto-sell timeline for the shared slider, 7D / 14D / 30D presets, and multi-position estimates.':
    '使用浮动自动卖出时间线来控制共享滑杆、7D / 14D / 30D 预设和多仓位估算。',
  'Entry anchor': '建仓锚点',
  'Auto-sell bar': '自动卖出 K 线',
  'Sell size': '卖出数量',
  'Buy first for timed exit': '先买入才能定时退出',
  'Buy first': '请先买入',
  'What happens?': '会发生什么？',
  Buy: '买入',
  Sell: '卖出',
  'Current replay ticket': '当前回放订单',
  'Trade focus': '交易焦点',
  'Trade date': '交易日期',
  'Trade price': '交易价格',
  'Ticket notional': '订单名义金额',
  'Estimated buy size': '预计买入数量',
  'Open position now': '当前开仓数量',
  'Position at bar': '该 K 线持仓',
  'Trade exit value': '交易退出价值',
  'Trade realized PnL': '交易已实现 PnL',
  'Trade net PnL': '交易净 PnL',
  'Evidence before trade': '交易前证据',
  'Structure clarity': '结构清晰度',
  'Pricing / NAV transparency': '价格 / 净值透明度',
  'Liquidity / redemption': '流动性 / 赎回',
  'Underlying quality': '底层质量',
  'above avg': '高于平均',
  'Near avg': '接近平均',
  'below avg': '低于平均',
  'Direct market replay': '直接市场回放',
  'The replay uses a bundled price path or local product proxy.':
    '该回放使用打包价格路径或本地产品代理。',
  'T+0 / Replay buy / sell through the spot desk': 'T+0 / 通过现货操作台回放买卖',
  'What does the user own?': '用户持有什么？',
  'How is return generated?': '收益如何产生？',
  'Can the user redeem or exit?': '用户能否赎回或退出？',
  'Current positions': '当前持仓',
  Product: '产品',
  Units: '数量',
  'Avg entry': '平均入场价',
  Mark: '标记价',
  'Gross value': '毛价值',
  'Holding days': '持有天数',
  'Carry drag': '持有成本',
  'Net exit': '净退出',
  Realized: '已实现',
  'Trade history': '交易记录',
  'Replay fills': '回放成交',
  Side: '方向',
  Notional: '名义金额',
  Fees: '费用',
  Tax: '税费',
  Carry: '持有成本',
  Previous: '上一页',
  Page: '页',
  Showing: '显示',
  'Replay return leaderboard': '回放收益排行榜',
  'REPLAY LEADERBOARD': '回放排行榜',
  'Account returns': '账户收益',
  'Ranked by submitted replay return. Each wallet appears once using its best recorded score, so a lower re-submission will not move the row.':
    '按已提交的 replay 收益率排名。每个钱包只保留它的最佳记录，所以更低的重新提交不会改变当前排名。',
  'Replay quests': '回放任务',
  'Home-page onboarding is inherited by wallet, then replay starts from its own task ladder.':
    '首页新手引导会由钱包继承，之后回放模式再走自己的任务阶梯。',
  'Users only need to connect the same wallet, finish the local replay condition, switch MetaMask to Sepolia, and press the claim button. If replay badges are still offline, no code is required from the user; the project owner simply has not connected the replay badge contract yet.':
    '用户只需要连接同一个钱包、完成本地回放条件、把 MetaMask 切到 Sepolia，然后点击领取按钮。如果回放徽章还未上线，也不需要用户写代码；只是项目方还没有把回放徽章合约接进来。',
  'Unlocked tasks': '已解锁任务',
  'Claim-ready': '可领取',
  'Claimed onchain': '已在链上领取',
  'Onchain anchor': '链上锚点',
  'Set env var': '请配置环境变量',
  'Base Check': '基础检查',
  'Leaderboard': '排行榜',
  'Already claimed': '已领取',
  Complete: '已完成',
  'To do': '待完成',
  'Task detail': '任务详情',
  'Why this task exists': '为什么要做这个任务',
  'Wallet route': '钱包路径',
  'Inherited onboarding route': '继承的 onboarding 路径',
  'Replay buy / sell usage': '回放买 / 卖使用记录',
  'Wallet self-claim': '钱包自主领取',
  'Onchain badge id': '链上徽章编号',
  'Leaderboard score route': '排行榜分数路径',
  'Submit score on Sepolia': '在 Sepolia 提交分数',
  'Daily limit reached': '已达到当日上限',
  'Pending Sepolia confirmation': '等待 Sepolia 确认',
  'Carry over the same wallet that already finished the onboarding route.': '沿用已经完成 onboarding 路线的同一个钱包。',
  'Confirms that the same wallet passed onboarding and actually used replay trading instead of only opening the page.':
    '确认同一个钱包不仅完成了 onboarding，而且真的使用过 replay 交易，而不只是打开页面。',
  'Finish a positive closed loop and use the leaderboard submit action once.': '完成一次正收益闭环，并使用一次排行榜提交通道。',
  'Separates local replay profit from a real leaderboard interaction by proving that a score was actually submitted onchain.':
    '通过证明分数确实已经提交上链，把本地 replay 盈利与真实排行榜交互区分开。',
  'Paper usage verified': '已验证模拟交易使用',
  'Score route verified': '已验证排行榜提交',
  'PAPER USAGE VERIFIED': '已验证模拟交易使用',
  'SCORE ROUTE VERIFIED': '已验证排行榜提交',
  'Use the same wallet and record the first replay fill.': '使用同一个钱包，并记录第一笔 replay 成交。',
  'Finish a positive PnL loop and use the leaderboard submit action once.': '完成一次正收益闭环，并使用一次排行榜提交操作。',
  'This collectible marks that the wallet actually used replay trading, not just opened the page.':
    '这个收藏品证明该钱包真的使用过 replay 交易，而不只是打开了页面。',
  'Submit a positive replay score on Sepolia to stamp this collectible.':
    '在 Sepolia 上提交一次正收益 replay 分数来盖上这个收藏品印记。',
  'Wallet route carried over': '钱包路径已继承',
  'Wallet route pending': '钱包路径待完成',
  'No replay fill recorded yet': '还没有记录 replay 成交',
  'No score submission recorded yet': '还没有分数提交通知',
  shown: '条',
  unlocked: '已解锁',
  'A positive closed replay result already exists for this wallet.': '这个钱包已经有一次正收益的闭环 replay 结果。',
  'Finish one positive replay trade loop before using the leaderboard route.': '先完成一次正收益 replay 闭环，再使用排行榜路线。',
  'This wallet already used the leaderboard submit action on Sepolia.': '这个钱包已经在 Sepolia 上使用过排行榜提交操作。',
  'Submit the current replay score once on Sepolia so this badge represents a real leaderboard action.':
    '在 Sepolia 上提交一次当前 replay 分数，这样这个徽章才代表真实的排行榜操作。',
  'Current replay score is based on strategy-only paper capital, so onboarding token rewards do not inflate the result before it is sent onchain.':
    '当前回放分数只基于策略模拟资金计算，因此在发到链上前不会被 onboarding 代币奖励放大。',
  'Replay net PnL:': '回放净收益：',
  'Strategy value:': '策略价值：',
  'Closed trades:': '已平仓交易：',
  'Daily submit usage:': '当日提交次数：',
  'Latest score tx:': '最近一次分数交易：',
  'Latest claim tx:': '最近一次 claim 交易：',
  'This wallet already carries the welcome badge plus guide and quiz completion from the home page, including onchain task badges and reviewed product briefings.':
    '这个钱包已经继承了首页的欢迎徽章、guide 和 quiz 完成进度，包括链上任务徽章和已阅读风险卡片。',
  'Replay mode checks the same wallet for the welcome badge, then accepts guide progress from reviewed product briefings or the risk badge, and quiz progress from the quiz badge or local pass state.':
    'Replay 模式会检查同一个钱包是否有欢迎徽章，然后接受来自已阅读风险卡片或风险徽章的 guide 进度，以及来自 quiz 徽章或本地通过状态的 quiz 进度。',
  'This wallet already used at least one replay buy or sell action.': '这个钱包已经至少使用过一次 replay 买入或卖出操作。',
  'Place at least one replay buy or sell so the wallet proves it used the trading surface.':
    '至少执行一次 replay 买入或卖出，让这个钱包证明它真的使用过交易界面。',
  'This wallet already holds the replay achievement onchain.': '这个钱包已经持有链上的 replay 成就。',
  'MetaMask is already on Sepolia with gas available, so the claim route is ready.': 'MetaMask 已经在 Sepolia 上且有可用 gas，因此 claim 路线已经准备好。',
  'After the task turns green, switch MetaMask to Sepolia and keep a little Sepolia ETH in the wallet before pressing claim.':
    '任务变绿后，把 MetaMask 切到 Sepolia，并在钱包里保留少量 Sepolia ETH 再点击 claim。',
  'Reach positive replay PnL first': '先实现正收益 replay',
  'All products': '全部产品',
  'Funding / cash management': '资金 / 现金管理',
  'Public liquid markets': '公开流动市场',
  'Private markets / pre-IPO': '私募市场 / Pre-IPO',
  'Leverage / hedging': '杠杆 / 对冲',
  'Earn / yield': '赚币 / 收益',
  'Structured / strategy': '结构化 / 策略',
  'AI / automation': 'AI / 自动化',
  'Product lanes': '产品分类',
  'Explain panel': '解释面板',
  'Replay bar': '回放位置',
  'Selected replay price': '当前回放价格',
  'Selected position': '当前持仓',
  'Net exit value': '净退出价值',
  'Gross PnL': '毛收益',
  'Net PnL': '净收益',
  'Paper notional': '模拟投入金额',
  'Available cash': '可用现金',
  'Entry drag': '进场摩擦成本',
  'Buy at replay close': '按回放收盘价买入',
  'Sell at replay close': '按回放收盘价卖出',
  Prev: '上一步',
  Play: '播放',
  Pause: '暂停',
  Next: '下一步',
  Slow: '慢速',
  Normal: '正常',
  Fast: '快速',
  'Learning route': '学习路线',
  'Open positions': '当前持仓',
  'Wallet-linked replay holdings': '钱包绑定的回放持仓',
  'Trade log': '交易记录',
  'No replay positions yet': '还没有回放持仓',
  'No replay trades yet': '还没有回放交易',
  'Spot swing': '现货波段',
  'Perp tutorial': '合约教程',
  'DeFi lending': 'DeFi 借贷',
  'Borrow loop': '借贷循环',
  'Routing and rights': '路由与权利',
  'Spot swing route': 'Spot swing 路线',
  'Perp tutorial route': '合约教程路线',
  'DeFi lending route': 'DeFi 借贷路线',
  'Borrow loop route': '借贷循环路线',
  'Routing tutorial': '路由教程',
  'Keep the first pass simple: choose the entry bar, size the ticket, and practice low-buy / high-sell.':
    '第一轮先保持简单：选择入场 bar、设定投入金额，并练习低买高卖。',
  'Use the same replay bar, but frame the action as a perp tutorial with liquidation awareness.':
    '仍然使用同一条 replay bar，但把操作理解成带有爆仓意识的合约教程。',
  'Switch the desk into supply / withdraw teaching so the action matches lending logic.':
    '把操作台切换成存入 / 提取教学，让动作更符合借贷逻辑。',
  'Preview the two-step collateral and borrow sequence before the deeper lab is opened.':
    '在进入更深的实验室前，先预览抵押与借出这两个步骤。',
  'Focus on venue logic, fee path, and execution route before placing a replay action.':
    '在执行 replay 之前，先关注交易场所逻辑、费用路径与执行路线。',
  'Open long tutorial': '打开做多教程',
  'Open short tutorial': '打开做空教程',
  'Deposit tutorial': '存入教程',
  'Exit tutorial': '退出教程',
  'Supply leg': '供给腿',
  'Borrow leg': '借款腿',
  'Review route': '查看路线',
  'Exit route': '退出路线',
  'Leaderboard record required': '需要排行榜记录',
  'Developer mode override': '开发者模式覆盖',
  'Leaderboard routes unlocked': '排行榜路线已解锁',
  'Complete task first': '请先完成任务',
  'Ready to claim': '可以领取',
  'Reward route offline': '奖励路线未开启',
  'Waiting for demo setup': '等待演示环境配置',
  'Claim on Sepolia': '在 Sepolia 领取',
  'Complete route first': '请先完成路径',
  'Submitted score': '已提交分数',
  'Risk': '风险',
  Low: '低',
  Medium: '中',
  High: '高',
  'All local replay tasks are complete.': '本地回放任务已全部完成。',
  'No replay timestamp yet': '还没有回放时间戳',
  'Completed:': '已完成：',
  'Progress:': '进度：',
  'Mint risk task badge': '铸造风险任务徽章',
  'Review 3 cards first': '先查看 3 张卡片',
  'Quiz product': '测验产品',
  'What does the user actually own here?': '用户在这里实际持有什么？',
  'What is the clearest downside to explain?': '最需要解释清楚的 downside 是什么？',
  'Select one answer': '选择一个答案',
  'A wrapped product with specific access and disclosure limits': '一个带有特定访问和披露限制的包装型产品',
  'A bank deposit with principal protection': '一个保本的银行存款',
  'A guaranteed upside note with no downside': '一个没有 downside 的保收益票据',
  'Drawdown, access limits, or liquidity friction can still happen': '仍然可能出现回撤、访问限制或流动性摩擦',
  'There is basically no risk once tokenized': '一旦代币化基本就没有风险',
  'Gas fees are the only real risk': 'Gas 费用是唯一真正的风险',
  'Submit product quiz': '提交产品测验',
  'Quiz completed': '测验已完成',
  'Correct framing.': '理解正确。',
  'Try again.': '再试一次。',
  'The right answer is to explain what rights the wrapper gives and what downside or access limits still exist.':
    '正确答案是解释包装产品赋予了什么权利，以及仍然存在什么 downside 或访问限制。',
  'For beginner-safe framing, the user should understand that wrapper products are not bank deposits and can still have downside, access limits, or liquidity friction.':
    '对于面向新手的表达方式，用户应理解包装产品不是银行存款，仍可能存在 downside、访问限制或流动性摩擦。',
  'Mint quiz task badge': '铸造测验任务徽章',
  'Pass quiz first': '先通过测验',
  'Paper trading preview': '模拟交易预览',
  'This module should only open after the three prerequisite onboarding tasks are finished. When all three are done, this task can mint its own badge.':
    '这个模块应在三个前置 onboarding 任务完成后才开启。当这三项都完成时，这个任务可以铸造自己的徽章。',
  'Required before paper trading': '解锁模拟交易前需要完成',
  'Step 1: Connect wallet': '步骤 1：连接钱包',
  'Step 2: Mint welcome badge': '步骤 2：铸造欢迎徽章',
  'Step 3: Read risk cards': '步骤 3：阅读风险卡片',
  'Mint paper trading preview badge': '铸造模拟交易预览徽章',
  'This wallet already minted the paper trading preview badge.': '这个钱包已经铸造过模拟交易预览徽章。',
  'All three prerequisite tasks are complete. You can now mint the paper trading preview badge for this wallet.':
    '三个前置任务都已完成。你现在可以为这个钱包铸造模拟交易预览徽章。',
  'Finish the three prerequisite tasks above first, then mint the paper trading preview badge.':
    '请先完成上面的三个前置任务，再铸造模拟交易预览徽章。',
  'Open paper trading': '打开模拟交易',
  'Finish wallet tutorial to unlock': '先完成钱包教程才能解锁',
  'Open paper trading lab': '打开模拟交易实验室',
  'Starter products for a cleaner first touchpoint': '为第一次接触准备的更清晰产品入口',
  'Best for': '适合',
  'Beginner fit': '新手适配度',
  'Source of return': '收益来源',
  'Worst case': '最坏情况',
  'Protected': '保护型',
  'Growth': '成长型',
  'Growth Access': '成长机会入口',
  'Pre-IPO Growth': 'Pre-IPO 成长机会',
  'Pre-IPO / late-stage private allocation': 'Pre-IPO / 后期私募配置',
  'TradFi opportunity map': '传统金融机会地图',
  'Protected Growth Vault': '保护型成长金库',
  'Options / strategy': '期权 / 策略',
  Spot: '现货',
  xStock: 'xStock',
  'Bear Collar': '熊市领口策略',
  'Bear Collar route': '熊市领口策略路径',
  'Bear Collar preview': '熊市领口策略预览',
  'Short Put': '卖出看跌期权',
  'Short Put route': '卖出看跌期权路径',
  'Short Put preview': '卖出看跌预览',
  'Strategy controls': '策略控制',
  'Downside floor': '下跌保护线',
  'Profit harvest': '利润提取',
  'Upside cap': '上涨封顶',
  'Option premium': '期权权利金',
  'Strike OTM': '价外行权价',
  'Put floor': '看跌保护线',
  'Call credit': '卖出看涨收入',
  'Call cap': '看涨封顶',
  'Net premium': '净权利金',
  'Stress floor': '压力测试底线',
  'Premium kept': '保留权利金',
  'Call premium': '看涨权利金',
  'Call OTM': '看涨价外距离',
  'Payoff cap': '收益封顶',
  'Put premium': '看跌权利金',
  'Put OTM': '看跌价外距离',
  'Upside kept': '保留上涨空间',
  Entry: '建仓',
  Floor: '保护线',
  Cap: '封顶',
  Strike: '行权价',
  Settlement: '结算',
  'Auto-settle strategy': '自动结算策略',
  'Settle strategy': '结算策略',
  'Settle day': '结算日',
  'Settle bar': '结算 K 线',
  'Build paper strategy': '建立模拟策略',
  'Build strategy first': '先建立策略',
  'Build first': '先建立',
  'Best payoff #1': '最佳收益 #1',
  'Best payoff #2': '最佳收益 #2',
  'Downside test': '下跌压力测试',
  'Strategy payoff': '策略收益',
  'Strategy settle take-home': '策略结算到手金额',
  'Strategy settle est. PnL': '策略结算预计盈亏',
  'Historical move': '历史价格变化',
  'Max upside': '最大上涨',
  'Max downside': '最大下跌',
  'Premium': '权利金',
  'Breakeven': '盈亏平衡',
  'Pre-IPO / private-growth allocation': 'Pre-IPO / 私募成长配置',
  'SpaceX Secondary Window': 'SpaceX 二级份额窗口',
  'Stripe Pre-IPO Window': 'Stripe Pre-IPO 窗口',
  'ByteDance Private Growth': 'ByteDance 私募成长',
  'Databricks Secondary Window': 'Databricks 二级份额窗口',
  'OpenAI Private Growth': 'OpenAI 私募成长',
  'No fixed yield / event-driven mark': '无固定收益 / 事件驱动估值',
  'Demo watchlist / gated access route': '演示观察名单 / 门槛准入路径'
};

const DYNAMIC_RULES = [
  { pattern: /^Wallet connected (.+)$/i, replace: '钱包已连接 $1' },
  {
    pattern: /^You start with (.+) PT, each completed badge adds (.+) PT, and no real funds are involved\.$/i,
    replace: '初始会发放 $1 PT，每完成一个徽章再增加 $2 PT，全程不涉及真实资金。'
  },
  {
    pattern: /^Wallet memory: remaining (.+), total policy (.+), paper cash (.+), wealth cash (.+)\.$/i,
    replace: '钱包记忆：剩余 $1，总策略资金 $2，模拟交易现金 $3，理财现金 $4。'
  },
  {
    pattern: /^Unified wallet memory: policy (.+), remaining (.+), paper cash (.+), wealth cash (.+)\.$/i,
    replace: '统一钱包记忆：策略资金 $1，剩余 $2，模拟交易现金 $3，理财现金 $4。'
  },
  {
    pattern: /^Unified wallet memory: paper cash (.+), wealth cash (.+), remaining PT (.+)\.$/i,
    replace: '统一钱包记忆：模拟交易现金 $1，理财现金 $2，剩余 PT $3。'
  },
  {
    pattern: /^Wallet record keeps (.+) PT remaining\. Unrealized gross PnL (.+)\. Unrealized net PnL (.+)\.$/i,
    replace: '钱包记录保留 $1 PT 剩余额度。未实现毛收益 $2。未实现净收益 $3。'
  },
  { pattern: /^Linked wallet cash (.+) PT included\.$/i, replace: '已包含绑定钱包现金 $1 PT。' },
  {
    pattern: /^Core paper cash starts at (.+) PT\. Each completed onboarding milestone adds (.+) PT of replay credit\.$/i,
    replace: '基础模拟资金从 $1 PT 开始，每完成一个 onboarding 里程碑会增加 $2 PT 的回放额度。'
  },
  {
    pattern: /^Demo wealth cash starts at (.+) PT\. Each completed onboarding milestone adds (.+) PT of preview buying power\.$/i,
    replace: '理财页演示资金从 $1 PT 开始，每完成一个 onboarding 里程碑会额外增加 $2 PT 的预览购买力。'
  },
  { pattern: /^Next task: (.+)$/i, replace: '下一步任务：$1' },
  { pattern: /^Next wealth task: (.+)$/i, replace: '下一步理财任务：$1' },
  { pattern: /^Next replay task: (.+)$/i, replace: '下一个回放任务：$1' },
  { pattern: /^(\d+)\/(\d+) complete$/i, replace: '$1/$2 完成' },
  { pattern: /^Task (\d+) (.+)$/i, replace: '任务 $1 $2' },
  { pattern: /^Task (\d+)$/i, replace: '任务 $1' },
  { pattern: /^#(\d+)$/i, replace: '#$1' },
  { pattern: /^(\d+) products in view$/i, replace: '$1 个产品' },
  { pattern: /^(\d+) products$/i, replace: '$1 个产品' },
  { pattern: /^(\d+) wallets?$/i, replace: '$1 个钱包' },
  { pattern: /^(\d+) shown$/i, replace: '显示 $1 条' },
  { pattern: /^(\d+)\/(\d+) unlocked$/i, replace: '已解锁 $1/$2' },
  { pattern: /^Days forward: (.+) days forward$/i, replace: '时间向前：$1 天' },
  { pattern: /^Max borrow @ (.+)$/i, replace: '最高可借 @$1' },
  { pattern: /^Open support line on (.+)$/i, replace: '开启 $1 支持额度' },
  { pattern: /^Latest claim tx: (.+)$/i, replace: '最近一次 claim 交易：$1' },
  { pattern: /^Latest score tx: (.+)$/i, replace: '最近一次分数交易：$1' },
  { pattern: /^Replay net PnL: (.+)$/i, replace: 'Replay 净收益：$1' },
  { pattern: /^Strategy value: (.+)$/i, replace: '策略价值：$1' },
  { pattern: /^Closed trades: (.+)$/i, replace: '已平仓交易：$1' },
  { pattern: /^Daily submit usage: (.+)$/i, replace: '当日提交次数：$1' },
  { pattern: /^account value (.+)$/i, replace: '账户价值 $1' },
  { pattern: /^Open (.+) \/ Close (.+)$/i, replace: '开盘 $1 / 收盘 $2' },
  { pattern: /^Chart jumps to (.+)\. Press "Buy" for (.+) at about (.+)\.$/i, replace: '图表跳到 $1。点击“买入”以约 $3 买入 $2。' },
  {
    pattern: /^Stop day is (.+)\. The dock window becomes (.+), so multiple open products move together\.$/i,
    replace: '停止日是 $1。浮动栏窗口变为 $2，因此多个未平仓产品会一起移动。'
  },
  {
    pattern: /^Net result is modeled at (.+) after (.+) of entry, exit, tax, and carry drag\.$/i,
    replace: '模型化净结果为 $1，已扣除 $2 的进场、退出、税费和持有成本。'
  },
  {
    pattern: /^Guided (.+) buy\/sell drill: click "Start case", press "Buy", then use "Stop day" at (.+) or the (.+) dock preset\. Gross move (.+); modeled route drag (.+)\.$/i,
    replace: '引导式 $1 买卖练习：点击“开始案例”，点击“买入”，然后在 $2 使用“停止日”或 $3 浮动栏预设。毛价格变化 $4；模型化路线成本 $5。'
  },
  { pattern: /^net (.+)$/i, replace: '净收益 $1' },
  { pattern: /^Up most #(\d+)$/i, replace: '上涨最多 #$1' },
  { pattern: /^Small loss$/i, replace: '小幅亏损' },
  { pattern: /^Page (\d+) \/ (\d+) \| Showing (.+) of (.+) fills$/i, replace: '第 $1 / $2 页 | 显示第 $3 条，共 $4 条成交' },
  { pattern: /^(\d+) tasks?$/i, replace: '$1 个任务' }
];

function translateTextNode(text) {
  if (!text || !text.trim()) return text;

  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let translated = text;

  DYNAMIC_RULES.forEach(({ pattern, replace }) => {
    translated = translated.replace(pattern, replace);
  });

  Object.entries(EN_TO_ZH)
    .sort((left, right) => String(right[0]).length - String(left[0]).length)
    .forEach(([english, chinese]) => {
      translated = translated.split(english).join(chinese);
      const flexiblePattern = new RegExp(escapeRegex(english).replace(/\s+/g, '\\s+'), 'g');
      translated = translated.replace(flexiblePattern, chinese);
    });

  return translated;
}

function resolveOriginalNodeText(liveText, storedOriginalText) {
  const normalizedLiveText = liveText || '';

  if (storedOriginalText == null) {
    return normalizedLiveText;
  }

  if (normalizedLiveText === storedOriginalText) {
    return storedOriginalText;
  }

  const translatedStoredText = translateTextNode(storedOriginalText);
  return normalizedLiveText === translatedStoredText ? storedOriginalText : normalizedLiveText;
}

function walkAndTranslate(root, uiLanguage, textOriginalMap, attrOriginalMap) {
  if (!root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let currentNode = walker.currentNode;

  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      const liveText = currentNode.textContent || '';
      const originalText = resolveOriginalNodeText(liveText, textOriginalMap.get(currentNode));
      const nextText = uiLanguage === 'zh' ? translateTextNode(originalText) : originalText;

      textOriginalMap.set(currentNode, originalText);
      if (liveText !== nextText) {
        currentNode.textContent = nextText;
      }
    } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
      const originalAttrs = attrOriginalMap.get(currentNode) || {};
      let hasTranslatableAttr = false;

      TRANSLATABLE_ATTRIBUTES.forEach((attributeName) => {
        const attrValue = currentNode.getAttribute?.(attributeName);
        if (attrValue != null) {
          hasTranslatableAttr = true;
          originalAttrs[attributeName] = resolveOriginalNodeText(attrValue, originalAttrs[attributeName]);
        }
      });

      if (hasTranslatableAttr) {
        attrOriginalMap.set(currentNode, originalAttrs);
      }

      TRANSLATABLE_ATTRIBUTES.forEach((attributeName) => {
        if (!(attributeName in originalAttrs)) return;
        const nextAttrValue =
          uiLanguage === 'zh' ? translateTextNode(originalAttrs[attributeName]) : originalAttrs[attributeName];
        if (currentNode.getAttribute?.(attributeName) !== nextAttrValue) {
          currentNode.setAttribute(attributeName, nextAttrValue);
        }
      });
    }

    currentNode = walker.nextNode();
  }
}

export function getStoredUiLanguage() {
  if (typeof window === 'undefined') return 'en';
  const queryValue = new URLSearchParams(window.location.search).get('lang');
  if (queryValue === 'zh' || queryValue === 'en') {
    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, queryValue);
    return queryValue;
  }
  const value = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
  return value === 'zh' ? 'zh' : 'en';
}

export function useUiLanguage() {
  const [uiLanguage, setUiLanguage] = useState(getStoredUiLanguage);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, uiLanguage);

    const onStorage = (event) => {
      if (event.key === UI_LANGUAGE_STORAGE_KEY) {
        setUiLanguage(event.newValue === 'zh' ? 'zh' : 'en');
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [uiLanguage]);

  return {
    uiLanguage,
    setUiLanguage,
    t: (enText) => enText
  };
}

export function useDomTranslation(uiLanguage, selectors = ['.app-shell']) {
  const textOriginalMapRef = useRef(new WeakMap());
  const attrOriginalMapRef = useRef(new WeakMap());
  const selectorKey = useMemo(() => selectors.join('|'), [selectors]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    let applying = false;
    let scheduledFrame = 0;

    const applyTranslation = () => {
      if (applying) return;
      applying = true;

      selectorKey.split('|').forEach((selector) => {
        document.querySelectorAll(selector).forEach((root) => {
          walkAndTranslate(root, uiLanguage, textOriginalMapRef.current, attrOriginalMapRef.current);
        });
      });

      applying = false;
    };

    const scheduleTranslation = () => {
      if (applying || scheduledFrame) return;
      scheduledFrame = window.requestAnimationFrame(() => {
        scheduledFrame = 0;
        applyTranslation();
      });
    };

    applyTranslation();

    const observer = new MutationObserver(scheduleTranslation);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES
    });

    return () => {
      if (scheduledFrame) {
        window.cancelAnimationFrame(scheduledFrame);
      }
      observer.disconnect();
    };
  }, [selectorKey, uiLanguage]);
}

export function LanguageToggle({ uiLanguage, setUiLanguage, compact = false }) {
  return (
    <div className={`language-toggle ${compact ? 'compact' : ''}`.trim()} role="group" aria-label="Language toggle">
      <button
        type="button"
        className={`language-toggle-btn ${uiLanguage === 'en' ? 'active' : ''}`}
        onClick={() => setUiLanguage('en')}
      >
        EN
      </button>
      <button
        type="button"
        className={`language-toggle-btn ${uiLanguage === 'zh' ? 'active' : ''}`}
        onClick={() => setUiLanguage('zh')}
      >
        中文
      </button>
    </div>
  );
}
