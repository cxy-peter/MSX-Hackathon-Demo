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
  'Worst case': '最坏情况'
};

const DYNAMIC_RULES = [
  { pattern: /^Wallet connected (.+)$/i, replace: '钱包已连接 $1' },
  {
    pattern: /^Core paper cash starts at (.+) PT\. Each completed onboarding milestone adds (.+) PT of replay credit\.$/i,
    replace: '基础模拟资金从 $1 PT 开始，每完成一个 onboarding 里程碑会增加 $2 PT 的回放额度。'
  },
  {
    pattern: /^Demo wealth cash starts at (.+) PT\. Each completed onboarding milestone adds (.+) PT of preview buying power\.$/i,
    replace: '理财页演示资金从 $1 PT 开始，每完成一个 onboarding 里程碑会额外增加 $2 PT 的预览购买力。'
  },
  { pattern: /^Next replay task: (.+)$/i, replace: '下一个回放任务：$1' },
  { pattern: /^Task (\d+) (.+)$/i, replace: '任务 $1 $2' },
  { pattern: /^Task (\d+)$/i, replace: '任务 $1' },
  { pattern: /^#(\d+)$/i, replace: '#$1' },
  { pattern: /^(\d+) products in view$/i, replace: '$1 个产品' },
  { pattern: /^(\d+) shown$/i, replace: '显示 $1 条' },
  { pattern: /^(\d+)\/(\d+) unlocked$/i, replace: '已解锁 $1/$2' },
  { pattern: /^Latest claim tx: (.+)$/i, replace: '最近一次 claim 交易：$1' },
  { pattern: /^Latest score tx: (.+)$/i, replace: '最近一次分数交易：$1' },
  { pattern: /^Replay net PnL: (.+)$/i, replace: 'Replay 净收益：$1' },
  { pattern: /^Strategy value: (.+)$/i, replace: '策略价值：$1' },
  { pattern: /^Closed trades: (.+)$/i, replace: '已平仓交易：$1' },
  { pattern: /^Daily submit usage: (.+)$/i, replace: '当日提交次数：$1' },
  { pattern: /^account value (.+)$/i, replace: '账户价值 $1' },
  { pattern: /^(\d+) tasks?$/i, replace: '$1 个任务' }
];

function translateTextNode(text) {
  if (!text || !text.trim()) return text;

  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let translated = text;

  Object.entries(EN_TO_ZH)
    .sort((left, right) => String(right[0]).length - String(left[0]).length)
    .forEach(([english, chinese]) => {
      translated = translated.split(english).join(chinese);
      const flexiblePattern = new RegExp(escapeRegex(english).replace(/\s+/g, '\\s+'), 'g');
      translated = translated.replace(flexiblePattern, chinese);
    });

  DYNAMIC_RULES.forEach(({ pattern, replace }) => {
    translated = translated.replace(pattern, replace);
  });

  return translated;
}

function resolveOriginalNodeText(liveText, storedOriginalText, uiLanguage) {
  if (storedOriginalText == null) {
    return liveText || '';
  }

  if (uiLanguage === 'en') {
    return liveText !== storedOriginalText ? liveText : storedOriginalText;
  }

  const translatedStoredText = translateTextNode(storedOriginalText);
  return liveText !== storedOriginalText && liveText !== translatedStoredText ? liveText : storedOriginalText;
}

function walkAndTranslate(root, uiLanguage, textOriginalMap, attrOriginalMap) {
  if (!root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let currentNode = walker.currentNode;

  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      const liveText = currentNode.textContent || '';
      const originalText = resolveOriginalNodeText(liveText, textOriginalMap.get(currentNode), uiLanguage);
      const nextText = uiLanguage === 'zh' ? translateTextNode(originalText) : originalText;

      textOriginalMap.set(currentNode, originalText);
      if (liveText !== nextText) {
        currentNode.textContent = nextText;
      }
    } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
      const originalAttrs = attrOriginalMap.get(currentNode) || {};

      TRANSLATABLE_ATTRIBUTES.forEach((attributeName) => {
        const attrValue = currentNode.getAttribute?.(attributeName);
        if (attrValue != null) {
          originalAttrs[attributeName] = resolveOriginalNodeText(
            attrValue,
            originalAttrs[attributeName],
            uiLanguage
          );
        }
      });

      attrOriginalMap.set(currentNode, originalAttrs);

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

    applyTranslation();

    const observer = new MutationObserver(() => {
      if (applying) return;
      window.requestAnimationFrame(applyTranslation);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES
    });

    return () => observer.disconnect();
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
