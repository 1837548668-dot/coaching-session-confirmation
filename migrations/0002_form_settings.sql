CREATE TABLE IF NOT EXISTS form_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  intro_text TEXT NOT NULL,
  topics_title TEXT NOT NULL,
  topics_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO form_settings (
  id,
  intro_text,
  topics_title,
  topics_json,
  updated_at
) VALUES (
  1,
  '本次课程交付为轩辕（上海）教育科技有限公司（甲方）和________（乙方姓名）合作服务内容：课程仅限168000/268000元私董会成员参加，根据课程协议要求，为了保护双方的合法权益，如约完成课程的交付内容，甲方以书面形式告知本课程的内容明细及注意事项：',
  '本次辅导内容',
  '["如何精准看懂商业周期，把握时代风口与财富机遇？","如何锤炼强大心理素质，在商业竞争中从容破局？","如何打造世界级营销体系，实现品牌与业绩双爆发？","如何搭建顶尖商业组织，筑牢企业发展根基？","如何做好科学目标管理，让每一步行动都指向成功？","如何打造疯狂粉丝社群，沉淀高粘性客户资产？","如何实现企业自动化运营，摆脱事务性缠身？","如何搭建多元被动收入管道，实现财富自由？","如何做好全球资产配置，守住并放大财富？"]',
  0
);
