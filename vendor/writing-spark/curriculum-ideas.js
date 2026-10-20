// Original situation seeds covering characters in the Better Immersion reference.
// Word choices and prompts are ours, not a transcription of textbook vocabulary.
// The first form is always simplified; later forms are input aliases only.
const CURRICULUM_IDEAS = [
    { words: ['检查', '檢查'], meaning: 'check / inspect', ideas: [
        'Write about checking your backpack before leaving for a trip.',
        'Write about checking a model bridge to see why it wobbles.',
        'Write about checking a borrowed book before returning it.'
    ] },
    { words: ['家族'], meaning: 'extended family', ideas: [
        'Write about a tradition shared by several people in a family.',
        'Write about making a family tree for a class project.',
        'Write about a family gathering where relatives tell old stories.'
    ] },
    { words: ['华裔', '華裔'], meaning: 'person of Chinese descent', ideas: [
        'Write about a Chinese American child sharing a family tradition at school.',
        'Write about a person of Chinese descent whose work you would like to learn about.',
        'Write about two children of Chinese descent who live in different countries.'
    ] },
    { words: ['本子'], meaning: 'notebook', ideas: [
        'Write about choosing a notebook for your drawings.',
        'Write about finding a notebook full of old ideas.',
        'Write about decorating the cover of a new notebook.'
    ] },
    { words: ['正确', '正確'], meaning: 'correct', ideas: [
        'Write about finding the correct answer after checking your work.',
        'Write about learning the correct way to fold a paper airplane.',
        'Write about checking whether the time on a clock is correct.'
    ] },
    { words: ['祖先'], meaning: 'ancestors', ideas: [
        'Write about a question you would ask about your ancestors.',
        'Write about discovering where someone\'s ancestors lived.',
        'Write about a family tradition passed down from ancestors.'
    ] },
    { words: ['大脑', '大腦'], meaning: 'brain', ideas: [
        'Write about a question you have about how the brain remembers things.',
        'Write about seeing a model of a brain at a science museum.',
        'Write about learning how the brain helps you solve a puzzle.'
    ] },
    { words: ['心脏', '心臟'], meaning: 'heart (organ)', ideas: [
        'Write about noticing your heart beating faster after running.',
        'Write about a model that shows how the heart pumps.',
        'Write about a question you would ask in a lesson about the heart.'
    ] },
    { words: ['血液'], meaning: 'blood', ideas: [
        'Write about learning how blood moves through the body.',
        'Write about drawing the path of blood in a science diagram.',
        'Write about a question you have about what blood carries.'
    ] },
    { words: ['管理'], meaning: 'manage / take care of', ideas: [
        'Write about managing a classroom collection of games.',
        'Write about how a group manages the jobs for a school fair.',
        'Write about managing your time when you have several things to finish.'
    ] },
    { words: ['凉快', '涼快'], meaning: 'pleasantly cool', ideas: [
        'Write about finding a cool spot under a tree on a warm day.',
        'Write about a cool breeze coming through an open window.',
        'Write about choosing a cooler time of day for a walk.'
    ] },
    { words: ['弄坏', '弄壞'], meaning: 'accidentally damage / break', ideas: [
        'Write about what you do after accidentally breaking a toy.',
        'Write about carrying a fragile model carefully so you do not damage it.',
        'Write about helping fix something that was accidentally damaged.'
    ] },
    { words: ['医生', '醫生'], meaning: 'doctor', ideas: [
        'Write about a doctor answering a child\'s question during a checkup.',
        'Write about meeting a doctor at your school\'s career day.',
        'Write about a pretend doctor caring for a stuffed animal.'
    ] },
    { words: ['小组', '小組'], meaning: 'small group / team', ideas: [
        'Write about a small group choosing a name for its project.',
        'Write about your group dividing the work for a poster.',
        'Write about joining a group that is learning a new game.'
    ] },
    { words: ['兄弟'], meaning: 'brothers', ideas: [
        'Write about two brothers who enjoy different games.',
        'Write about brothers working together to build something.',
        'Write about one brother teaching another a new skill.'
    ] },
    { words: ['提醒'], meaning: 'remind', ideas: [
        'Write about reminding a friend to bring a library book.',
        'Write about a note that reminds you of an important task.',
        'Write about someone reminding your group when practice begins.'
    ] },
    { words: ['离开', '離開'], meaning: 'leave', ideas: [
        'Write about saying goodbye before leaving a relative\'s home.',
        'Write about the last thing you check before leaving the classroom.',
        'Write about leaving a park just as it starts to rain.'
    ] },
    { words: ['幸运', '幸運'], meaning: 'lucky / fortunate', ideas: [
        'Write about feeling lucky when you find something you lost.',
        'Write about being lucky enough to see a rainbow on a walk.',
        'Write about a lucky moment during a game.'
    ] },
    { words: ['满意', '滿意'], meaning: 'satisfied / pleased', ideas: [
        'Write about feeling satisfied with a model you worked hard on.',
        'Write about changing a drawing until you are pleased with it.',
        'Write about a group feeling satisfied with its finished project.'
    ] },
    { words: ['志愿者', '志願者'], meaning: 'volunteer', ideas: [
        'Write about volunteers helping at a school festival.',
        'Write about a volunteer reading stories at a library.',
        'Write about a job you would enjoy doing as a volunteer.'
    ] },
    { words: ['送给', '送給'], meaning: 'give as a gift', ideas: [
        'Write about giving a handmade bookmark to a friend.',
        'Write about choosing whom to give your drawing to.',
        'Write about giving someone a small surprise on an ordinary day.'
    ] },
    { words: ['建设', '建設'], meaning: 'build / develop', ideas: [
        'Write about building a new playground for a neighborhood.',
        'Write about watching workers build a library.',
        'Write about a town deciding what to build on an empty lot.'
    ] },
    { words: ['野外'], meaning: 'outdoors / the wild', ideas: [
        'Write about observing animals outdoors with a guide.',
        'Write about packing for a class outing in nature.',
        'Write about the sounds you hear while camping in the wild.'
    ] },
    { words: ['诚实', '誠實'], meaning: 'honest', ideas: [
        'Write about being honest after making a mistake in a game.',
        'Write about returning something that belongs to someone else.',
        'Write about an honest character in a story you know.'
    ] },
    { words: ['杀菌', '殺菌'], meaning: 'kill germs / sterilize', ideas: [
        'Write about learning why kitchen workers sterilize cooking equipment.',
        'Write about asking how a bottle-sterilizing machine works.',
        'Write about a science display explaining how heat can kill germs.'
    ] },
    { words: ['危险', '危險'], meaning: 'danger / dangerous', ideas: [
        'Write about noticing a warning sign near a steep path.',
        'Write about a character choosing a safer way around a dangerous place.',
        'Write about explaining why a slippery floor could be dangerous.'
    ] },
    { words: ['争取', '爭取'], meaning: 'strive for / try to obtain', ideas: [
        'Write about working to earn a place on a team.',
        'Write about your class trying to get more time for a favorite activity.',
        'Write about practicing to earn a chance to perform in a show.'
    ] },
    { words: ['森林'], meaning: 'forest', ideas: [
        'Write about walking along a shady forest path.',
        'Write about an animal that makes its home in a forest.',
        'Write about how a forest looks after fresh snow.'
    ] },
    { words: ['操场', '操場'], meaning: 'school playground / sports field', ideas: [
        'Write about a game your class plays on the sports field.',
        'Write about the playground becoming busy at recess.',
        'Write about finding a quiet corner of the school playground.'
    ] },
    { words: ['主人'], meaning: 'owner / host', ideas: [
        'Write about finding the owner of a lost hat.',
        'Write about a host welcoming guests to a party.',
        'Write about a dog greeting its owner after school.'
    ] },
    { words: ['海洋'], meaning: 'ocean', ideas: [
        'Write about an ocean animal you want to learn more about.',
        'Write about seeing the ocean for the first time.',
        'Write about a question you have about the deep ocean.'
    ] },
    { words: ['不仅', '不僅'], meaning: 'not only', ideas: [
        'Write about a friend who is good at more than one thing.',
        'Write about a trip where you both had fun and learned something.',
        'Write about a gift that is useful as well as beautiful.'
    ] },
    { words: ['手指'], meaning: 'finger', ideas: [
        'Write about using your fingers to make a shadow animal.',
        'Write about getting paint on your fingers while making art.',
        'Write about learning which fingers to use on a musical instrument.'
    ] },
    { words: ['关系', '關係'], meaning: 'relationship / connection', ideas: [
        'Write about the relationship between two characters in a story.',
        'Write about how sharing a hobby changes a friendship.',
        'Write about the connection between rain and a growing garden.'
    ] },
    { words: ['旁边', '旁邊'], meaning: 'beside / next to', ideas: [
        'Write about sitting beside a friend on a bus.',
        'Write about a small flower growing next to a large tree.',
        'Write about what you keep beside your bed.'
    ] },
    { words: ['停止'], meaning: 'stop', ideas: [
        'Write about music stopping during a dancing game.',
        'Write about stopping to watch a butterfly on a walk.',
        'Write about the rain stopping just before recess.'
    ] },
    { words: ['谈话', '談話'], meaning: 'talk / conversation', ideas: [
        'Write about a conversation with a grandparent about school long ago.',
        'Write about talking with a friend while waiting for a bus.',
        'Write about a conversation that gives you a new idea.'
    ] },
    { words: ['访问', '訪問'], meaning: 'visit / interview', ideas: [
        'Write about interviewing someone about an interesting job.',
        'Write about a visiting class coming to your school.',
        'Write about questions for a visitor who has traveled far away.'
    ] },
    { words: ['判断', '判斷'], meaning: 'judge / decide based on clues', ideas: [
        'Write about using dark clouds to judge whether it might rain.',
        'Write about deciding which container holds more water.',
        'Write about using clues to decide which character left a note.'
    ] },
    { words: ['过程', '過程'], meaning: 'process', ideas: [
        'Write about one step in the process of making a paper lantern.',
        'Write about something surprising during the process of growing a bean.',
        'Write about explaining how your group built its model.'
    ] },
    { words: ['寻找', '尋找'], meaning: 'search for', ideas: [
        'Write about searching for a missing puzzle piece.',
        'Write about looking for a good spot to fly a kite.',
        'Write about a character searching for the source of a strange sound.'
    ] },
    { words: ['根据', '根據'], meaning: 'according to / based on', ideas: [
        'Write about choosing clothes based on a weather forecast.',
        'Write about using a map to decide which way to walk.',
        'Write about guessing what an animal eats based on its teeth.'
    ] },
    { words: ['围墙', '圍牆'], meaning: 'boundary wall', ideas: [
        'Write about flowers growing beside a garden wall.',
        'Write about a mural painted on a school boundary wall.',
        'Write about an animal resting in the shade of a wall.'
    ] },
    { words: ['石块', '石塊'], meaning: 'stone / piece of rock', ideas: [
        'Write about finding a stone with an unusual shape.',
        'Write about comparing a smooth stone with a rough one.',
        'Write about using small stones to mark a garden path.'
    ] },
    { words: ['拼图', '拼圖'], meaning: 'jigsaw puzzle', ideas: [
        'Write about finding the final piece of a jigsaw puzzle.',
        'Write about choosing a puzzle to do with a friend.',
        'Write about sorting puzzle pieces by their colors.'
    ] },
    { words: ['休息'], meaning: 'rest / take a break', ideas: [
        'Write about resting in the shade after a long walk.',
        'Write about taking a short break from a difficult project.',
        'Write about a quiet place where you like to rest.'
    ] },
    { words: ['开始', '開始'], meaning: 'begin / start', ideas: [
        'Write about the moment a school performance begins.',
        'Write about starting a new notebook on the first day of school.',
        'Write about deciding where to begin a large puzzle.'
    ] },
    { words: ['冲洗', '沖洗'], meaning: 'rinse / wash with flowing water', ideas: [
        'Write about rinsing mud off your boots after a walk.',
        'Write about rinsing paint from a brush after art time.',
        'Write about washing sand from a beach toy before bringing it home.'
    ] },
    { words: ['地震'], meaning: 'earthquake', ideas: [
        'Write about practicing an earthquake drill with your class.',
        'Write about a science model that shows how earthquakes happen.',
        'Write about a question you would ask a scientist about earthquakes.'
    ] },
    { words: ['座位'], meaning: 'seat', ideas: [
        'Write about choosing a seat on a bus trip.',
        'Write about saving a seat for a friend at a performance.',
        'Write about what you can see from your classroom seat.'
    ] },
    { words: ['灰色'], meaning: 'gray', ideas: [
        'Write about a gray animal you have seen.',
        'Write about gray clouds covering the sky.',
        'Write about mixing paint to make a shade of gray.'
    ] },
    { words: ['元'], meaning: 'yuan (unit of money)', ideas: [
        'Write about a pretend shop where a pencil costs one yuan.',
        'Write about counting how many yuan you need for a small gift.',
        'Write about comparing the prices of two snacks in yuan.'
    ] },
    { words: ['既然'], meaning: 'since / now that', ideas: [
        'Write about what to do now that everyone has arrived for a game.',
        'Write about changing your plans since the park is closed.',
        'Write about choosing a new challenge now that you finished a project.'
    ] },
    { words: ['桌子'], meaning: 'table / desk', ideas: [
        'Write about clearing a table to make room for a craft project.',
        'Write about something surprising found under a desk.',
        'Write about setting a table for a special meal.'
    ] },
    { words: ['并且', '並且'], meaning: 'and also / furthermore', ideas: [
        'Write about a game that is fun and also teaches you something.',
        'Write about a friend doing two helpful things in one afternoon.',
        'Write about a picnic spot that is shady and also near a playground.'
    ] },
    { words: ['整理'], meaning: 'tidy / organize', ideas: [
        'Write about organizing your backpack before a new school week.',
        'Write about sorting a collection of shells or stones.',
        'Write about tidying a bookshelf and finding a forgotten book.'
    ] },
    { words: ['吧'], meaning: 'can soften a suggestion or request', ideas: [
        'Write about suggesting a game for your friends to play.',
        'Write about inviting someone to sit beside you.',
        'Write about gently suggesting a break after a long walk.'
    ] },
    { words: ['剩余', '剩餘'], meaning: 'remaining / left over', ideas: [
        'Write about using leftover paper from a craft project.',
        'Write about counting the puzzle pieces that remain.',
        'Write about deciding how to use the time left before lunch.'
    ] },
    { words: ['表演'], meaning: 'perform / performance', ideas: [
        'Write about performing a short play with your friends.',
        'Write about a performance that made you laugh.',
        'Write about practicing the opening of a school performance.'
    ] },
    { words: ['一双', '一雙'], meaning: 'a pair (of shoes, hands, etc.)', ideas: [
        'Write about a pair of boots you wear on rainy days.',
        'Write about finding a pair of tiny mittens in an old box.',
        'Write about choosing a pair of shoes for a long walk.'
    ] },
    { words: ['一般'], meaning: 'usually / ordinary / average', ideas: [
        'Write about what your family usually does after dinner.',
        'Write about the time you usually arrive at school.',
        'Write about an ordinary-looking box with something surprising inside.'
    ] },
    { words: ['速度'], meaning: 'speed', ideas: [
        'Write about comparing the speed of two toy cars.',
        'Write about a runner changing speed near the finish line.',
        'Write about watching a snail move at its own slow speed.'
    ] },
    { words: ['精彩'], meaning: 'wonderful / exciting / impressive', ideas: [
        'Write about the most exciting part of a performance.',
        'Write about an impressive move during a sports game.',
        'Write about a wonderful story you want someone else to hear.'
    ] },
    { words: ['克服'], meaning: 'overcome', ideas: [
        'Write about overcoming nervousness before speaking to a group.',
        'Write about solving a difficulty while learning to ride a bicycle.',
        'Write about a character overcoming a problem with a friend\'s help.'
    ] },
    { words: ['将来', '將來'], meaning: 'the future', ideas: [
        'Write about a skill you hope to have in the future.',
        'Write about a place you would like to visit when you are older.',
        'Write about what your school might look like in the future.'
    ] },
    { words: ['普通'], meaning: 'ordinary / common', ideas: [
        'Write about an ordinary object you turn into a toy.',
        'Write about an ordinary day that suddenly becomes memorable.',
        'Write about a common stone that looks interesting when wet.'
    ] },
    { words: ['工具'], meaning: 'tool', ideas: [
        'Write about choosing a tool for planting seeds.',
        'Write about a tool that makes an art project easier.',
        'Write about asking an adult what an unfamiliar tool is used for.'
    ] },
    { words: ['客厅', '客廳'], meaning: 'living room', ideas: [
        'Write about playing a board game in the living room.',
        'Write about rearranging the living room for visitors.',
        'Write about your favorite place to sit in the living room.'
    ] },
    { words: ['有益'], meaning: 'beneficial / helpful', ideas: [
        'Write about a daily habit that helps you learn.',
        'Write about an activity that benefits both you and a friend.',
        'Write about why reading different kinds of books can be helpful.'
    ] },
    { words: ['获得', '獲得'], meaning: 'obtain / gain / receive', ideas: [
        'Write about gaining a new skill by practicing.',
        'Write about receiving a chance to lead a group activity.',
        'Write about something useful you learned from a mistake.'
    ] },
    { words: ['奖品', '獎品'], meaning: 'prize', ideas: [
        'Write about choosing a small prize for a class game.',
        'Write about a homemade prize that makes someone smile.',
        'Write about winning a prize and sharing the news with a friend.'
    ] },
    { words: ['带领', '帶領'], meaning: 'lead / guide', ideas: [
        'Write about leading visitors around your school.',
        'Write about a guide leading a group along a nature trail.',
        'Write about leading your classmates in a new game.'
    ] },
    { words: ['任务', '任務'], meaning: 'task / assignment', ideas: [
        'Write about a task your group needs to finish before a show.',
        'Write about choosing which task to do first on a busy morning.',
        'Write about a character given a surprising task in a story.'
    ] },
    { words: ['态度', '態度'], meaning: 'attitude', ideas: [
        'Write about keeping a positive attitude when a game is difficult.',
        'Write about how a character\'s attitude changes after meeting someone.',
        'Write about the attitude you want to bring to learning a new skill.'
    ] },
    { words: ['刚才', '剛才'], meaning: 'just now / a moment ago', ideas: [
        'Write about a sound you heard just a moment ago.',
        'Write about looking for something that was on your desk just now.',
        'Write about telling a friend what just happened outside.'
    ] },
    { words: ['啊'], meaning: 'an exclamation such as ah / oh', ideas: [
        'Write about your reaction when you finally understand a puzzle.',
        'Write about a character\'s surprised reaction to an unexpected gift.',
        'Write about exclaiming when you see a beautiful view.'
    ] },
    { words: ['叹气', '嘆氣'], meaning: 'sigh', ideas: [
        'Write about a character sighing after missing a bus.',
        'Write about someone sighing with relief after finding a lost key.',
        'Write about a friend sighing when a picnic is postponed.'
    ] },
    { words: ['另外'], meaning: 'another / in addition', ideas: [
        'Write about suggesting another route when a path is closed.',
        'Write about one more thing you need for a craft project.',
        'Write about choosing a different book after finishing the first one.'
    ] },
    { words: ['结束', '結束'], meaning: 'end / finish', ideas: [
        'Write about what your class does when a performance ends.',
        'Write about the last moment of a memorable trip.',
        'Write about ending a game so that everyone can help clean up.'
    ] },
    { words: ['表示'], meaning: 'express / indicate', ideas: [
        'Write about expressing thanks to someone who helped you.',
        'Write about a sign that shows where a path leads.',
        'Write about using a gesture to show that you agree.'
    ] },
    { words: ['吉利'], meaning: 'lucky / auspicious', ideas: [
        'Write about a decoration that a family considers lucky.',
        'Write about asking why a certain number is considered lucky.',
        'Write about choosing a lucky-sounding name for a pretend shop.'
    ] },
    { words: ['研究'], meaning: 'research / study closely', ideas: [
        'Write about researching why some leaves change color.',
        'Write about studying different ways to make a paper bridge stronger.',
        'Write about choosing an animal to research for a report.'
    ] },
    { words: ['习惯', '習慣'], meaning: 'habit / be accustomed to', ideas: [
        'Write about a helpful habit you want to build.',
        'Write about getting used to a new classroom routine.',
        'Write about a habit that makes it easier to find your belongings.'
    ] },
    { words: ['思考'], meaning: 'think carefully', ideas: [
        'Write about thinking carefully before choosing a solution.',
        'Write about a question that makes you stop and think.',
        'Write about a quiet place where you can think about a new idea.'
    ] },
    { words: ['书架', '書架'], meaning: 'bookshelf', ideas: [
        'Write about arranging books on a shelf in a new way.',
        'Write about finding an unexpected object on a bookshelf.',
        'Write about choosing a book from the highest shelf you can reach.'
    ] },
    { words: ['散步'], meaning: 'take a walk', ideas: [
        'Write about taking an evening walk with your family.',
        'Write about noticing a new sound during a familiar walk.',
        'Write about choosing a route for a walk with a friend.'
    ] },
    { words: ['礼貌', '禮貌'], meaning: 'polite / good manners', ideas: [
        'Write about politely asking to join a game.',
        'Write about showing good manners when someone visits your home.',
        'Write about a polite way to disagree with a friend.'
    ] },
];
