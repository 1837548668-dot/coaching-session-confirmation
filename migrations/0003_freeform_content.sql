ALTER TABLE form_settings ADD COLUMN content_text TEXT NOT NULL DEFAULT '';
ALTER TABLE form_settings ADD COLUMN agreement_title TEXT NOT NULL DEFAULT '特别约定（必读）';
ALTER TABLE form_settings ADD COLUMN agreement_text TEXT NOT NULL DEFAULT '';

UPDATE form_settings
SET
  content_text = '如何精准看懂商业周期，把握时代风口与财富机遇？
如何锤炼强大心理素质，在商业竞争中从容破局？
如何打造世界级营销体系，实现品牌与业绩双爆发？
如何搭建顶尖商业组织，筑牢企业发展根基？
如何做好科学目标管理，让每一步行动都指向成功？
如何打造疯狂粉丝社群，沉淀高粘性客户资产？
如何实现企业自动化运营，摆脱事务性缠身？
如何搭建多元被动收入管道，实现财富自由？
如何做好全球资产配置，守住并放大财富？',
  agreement_title = '特别约定（必读）',
  agreement_text = '退款说明：本课程为线下知识交付服务，一经报名确认，费用不予退款；课程结束时，视为服务已完成，后续可以申请复训，仅需承担相应食宿场地费等。

知识产权：课程所有内容（课件、话术、工具、音视频等）归甲方所有，禁止录音、录像、复制、传播、商用，违者追究法律责任。

乙方签字即确认已充分知悉并同意以上全部条款。'
WHERE id = 1;
