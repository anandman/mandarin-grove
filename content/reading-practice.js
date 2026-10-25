// Original short starter texts. Character fit is checked; fluent teaching review remains pending.
(function(root){
 const pack={schemaVersion:1,id:'grove-reading-practice',version:'2026-10-25.1',items:[
  {id:'grove-pets',titleZh:'小猫和小狗',paragraphs:['我家有一只小猫。','小猫爱吃鱼。','朋友家有一只小狗。','我和朋友都爱小猫和小狗。'],
   pinyin:['Wǒ jiā yǒu yī zhī xiǎo māo.','Xiǎo māo ài chī yú.','Péngyou jiā yǒu yī zhī xiǎo gǒu.','Wǒ hé péngyou dōu ài xiǎo māo hé xiǎo gǒu.'],english:['My family has a little cat.','The little cat loves eating fish.','My friend’s family has a little dog.','My friend and I both love the little cat and the little dog.'],
   annotations:[[{word:'小猫',pinyin:'xiǎo māo',meaning:'little cat'}],[{word:'吃鱼',pinyin:'chī yú',meaning:'eat fish'}],[{word:'小狗',pinyin:'xiǎo gǒu',meaning:'little dog'},{word:'朋友',pinyin:'péngyou',meaning:'friend'}],[]]},
  {id:'grove-tree',titleZh:'家门前的大树',paragraphs:['大树在我家门前。','我和朋友在树下说话。','下雨了。','我们去朋友家。'],
   pinyin:['Dà shù zài wǒ jiā mén qián.','Wǒ hé péngyou zài shù xià shuōhuà.','Xià yǔ le.','Wǒmen qù péngyou jiā.'],english:['The big tree is in front of my home.','My friend and I talk under the tree.','It starts raining.','We go to my friend’s home.'],
   annotations:[[{word:'大树',pinyin:'dà shù',meaning:'big tree'},{word:'门前',pinyin:'mén qián',meaning:'in front of the door'}],[{word:'树下',pinyin:'shù xià',meaning:'under the tree'},{word:'说话',pinyin:'shuōhuà',meaning:'talk'}],[{word:'下雨',pinyin:'xià yǔ',meaning:'rain; be raining'}],[]]},
  {id:'grove-shopping',titleZh:'买东西',paragraphs:['我和妈妈去买东西。','妈妈买了一个白色的球。','我很喜欢这个球。','朋友也喜欢这个球。'],
   pinyin:['Wǒ hé māma qù mǎi dōngxi.','Māma mǎi le yī ge báisè de qiú.','Wǒ hěn xǐhuān zhè ge qiú.','Péngyou yě xǐhuān zhè ge qiú.'],english:['My mother and I go shopping.','My mother buys a white ball.','I really like this ball.','My friend likes this ball too.'],
   annotations:[[{word:'买东西',pinyin:'mǎi dōngxi',meaning:'buy things; go shopping'}],[{word:'白色',pinyin:'báisè',meaning:'white'}],[{word:'喜欢',pinyin:'xǐhuān',meaning:'like'}],[]]},
  {id:'grove-rain-home',titleZh:'下雨回家',paragraphs:['下雨了。','我和朋友在学校。','妈妈来学校。','我和妈妈回家。'],
   pinyin:['Xià yǔ le.','Wǒ hé péngyou zài xuéxiào.','Māma lái xuéxiào.','Wǒ hé māma huí jiā.'],english:['It starts raining.','My friend and I are at school.','My mother comes to school.','My mother and I go home.'],
   annotations:[[{word:'下雨',pinyin:'xià yǔ',meaning:'rain; be raining'}],[{word:'学校',pinyin:'xuéxiào',meaning:'school'}],[],[{word:'回家',pinyin:'huí jiā',meaning:'go home'}]]}
 ]};
 for(const item of pack.items){
  item.kind='story';item.local=true;item.minGrade=2;item.sourceId='mandarin-grove';item.reviewStatus='authored-teaching-review-pending';
  item.characters=[...new Set((item.titleZh+item.paragraphs.join('')).match(/\p{Script=Han}/gu))];
  item.words=[...new Set(item.annotations.flat().map(w=>w.word))];item.support={pinyin:item.pinyin,english:item.english};delete item.pinyin;delete item.english;
 }
 if(typeof module!=='undefined'&&module.exports)module.exports=pack;else root.GROVE_READING_PRACTICE=pack;
})(globalThis);
