// Original sentence ideas for grades 2–4, not completed example sentences.
// Each word makes its characters' connection to the situation explicit.
// Put the simplified display word first; traditional forms are input aliases
// only. Do not guess from radicals or convert characters automatically.
// This is a starter collection, not a curriculum.
const CHARACTER_IDEAS = [
    ...CURRICULUM_IDEAS,
    // Weather and nature
    { words: ['下雨'], meaning: 'rain', ideas: [
        'Write about walking to school on a rainy morning.',
        'Write about sharing an umbrella with a friend in the rain.',
        'Write about the puddles outside your home after it rains.'
    ] },
    { words: ['雪'], meaning: 'snow', ideas: [
        'Write about making a tiny snowman outside your home.',
        'Write about catching a snowflake on your sleeve.',
        'Write about seeing snow cover the playground.'
    ] },
    { words: ['风', '風'], meaning: 'wind', ideas: [
        'Write about the wind blowing your hat away.',
        'Write about flying a kite on a windy afternoon.',
        'Write about hearing the wind outside your window.'
    ] },
    { words: ['云', '雲'], meaning: 'cloud', ideas: [
        'Write about a cloud shaped like your favorite animal.',
        'Write about watching dark clouds before a storm.',
        'Write about a cloud hiding the sun during a picnic.'
    ] },
    { words: ['太阳', '太陽'], meaning: 'sun', ideas: [
        'Write about a warm patch of sunlight where a pet sleeps.',
        'Write about watching the sun go down with your family.',
        'Write about finding shade on a sunny playground.'
    ] },
    { words: ['月亮'], meaning: 'moon', ideas: [
        'Write about spotting the moon on the way home.',
        'Write about the moon shining through your bedroom window.',
        'Write about imagining a trip to the moon.'
    ] },
    { words: ['星星'], meaning: 'stars', ideas: [
        'Write about counting stars with someone in your family.',
        'Write about looking for stars while camping.',
        'Write about making up a shape from the stars you see.'
    ] },
    { words: ['天气', '天氣'], meaning: 'weather', ideas: [
        'Write about choosing clothes for today’s weather.',
        'Write about weather that changes your plans for recess.',
        'Write about the kind of weather you want for a picnic.'
    ] },
    { words: ['水'], meaning: 'water', ideas: [
        'Write about filling your water bottle before a trip.',
        'Write about giving water to a thirsty plant.',
        'Write about splashing water while washing your hands.'
    ] },
    { words: ['河'], meaning: 'river', ideas: [
        'Write about watching a leaf float down a river.',
        'Write about crossing a bridge over a river.',
        'Write about the animals you see beside a river.'
    ] },
    { words: ['海'], meaning: 'sea', ideas: [
        'Write about hearing waves when you arrive at the sea.',
        'Write about looking for shells beside the sea.',
        'Write about imagining an animal deep in the sea.'
    ] },
    { words: ['山'], meaning: 'mountain', ideas: [
        'Write about a family walk up a mountain trail.',
        'Write about seeing a mountain from your window.',
        'Write about what you would pack for a mountain hike.'
    ] },
    { words: ['花'], meaning: 'flower', ideas: [
        'Write about choosing flowers for someone you love.',
        'Write about finding a flower growing beside a path.',
        'Write about a bee visiting a flower in the garden.'
    ] },
    { words: ['树', '樹'], meaning: 'tree', ideas: [
        'Write about resting in the shade of a tree.',
        'Write about a bird building a nest in a tree.',
        'Write about a tree outside your home changing with the seasons.'
    ] },
    { words: ['草'], meaning: 'grass', ideas: [
        'Write about sitting on the grass for a picnic.',
        'Write about wet grass tickling your feet.',
        'Write about finding a tiny insect in the grass.'
    ] },
    { words: ['春天'], meaning: 'spring', ideas: [
        'Write about the first flowers you notice in spring.',
        'Write about playing outside on a warm spring day.',
        'Write about a baby animal you might see in spring.'
    ] },
    { words: ['夏天'], meaning: 'summer', ideas: [
        'Write about cooling down on a hot summer day.',
        'Write about a summer game you play outside.',
        'Write about a summer trip you would like to take.'
    ] },
    { words: ['秋天'], meaning: 'autumn', ideas: [
        'Write about collecting colorful leaves in autumn.',
        'Write about an autumn walk with your family.',
        'Write about choosing a jacket on a cool autumn morning.'
    ] },
    { words: ['冬天'], meaning: 'winter', ideas: [
        'Write about getting ready to go outside in winter.',
        'Write about a warm meal on a cold winter evening.',
        'Write about a game you play indoors during winter.'
    ] },
    // Animals
    { words: ['猫', '貓'], meaning: 'cat', ideas: [
        'Write about a cat hiding inside an empty box.',
        'Write about a kitten trying to catch its own tail.',
        'Write about a cat sleeping in a surprising place.'
    ] },
    { words: ['狗'], meaning: 'dog', ideas: [
        'Write about a dog waiting for someone to come home.',
        'Write about a puppy learning to fetch a ball.',
        'Write about taking a dog for a walk in the park.'
    ] },
    { words: ['鸟', '鳥'], meaning: 'bird', ideas: [
        'Write about hearing a bird outside your window.',
        'Write about a bird picking up a twig for its nest.',
        'Write about watching birds fly over the playground.'
    ] },
    { words: ['鱼', '魚'], meaning: 'fish', ideas: [
        'Write about a colorful fish hiding behind a rock.',
        'Write about feeding a pet fish before school.',
        'Write about watching fish swim in a pond.'
    ] },
    { words: ['兔'], meaning: 'rabbit', ideas: [
        'Write about a rabbit nibbling a leaf.',
        'Write about a rabbit hopping across a garden.',
        'Write about choosing a name for a pet rabbit.'
    ] },
    { words: ['马', '馬'], meaning: 'horse', ideas: [
        'Write about seeing a horse on a farm.',
        'Write about a horse running across a field.',
        'Write about imagining a ride on a tiny horse.'
    ] },
    { words: ['牛'], meaning: 'cow', ideas: [
        'Write about a cow eating grass on a farm.',
        'Write about hearing a cow moo for the first time.',
        'Write about a baby cow staying close to its mother.'
    ] },
    { words: ['羊'], meaning: 'sheep', ideas: [
        'Write about a sheep with very fluffy wool.',
        'Write about counting sheep in a field.',
        'Write about a little lamb following the other sheep.'
    ] },
    { words: ['虫', '蟲'], meaning: 'insect', ideas: [
        'Write about finding an insect under a leaf.',
        'Write about an insect landing on your notebook.',
        'Write about watching an insect crawl across a stone.'
    ] },
    // Home, people, and school
    { words: ['家'], meaning: 'home / family', ideas: [
        'Write about your favorite place to read at home.',
        'Write about a game your family plays together.',
        'Write about the first thing you do when you get home.'
    ] },
    { words: ['妈妈', '媽媽'], meaning: 'mom', ideas: [
        'Write about making a small surprise for your mom.',
        'Write about helping your mom with a job at home.',
        'Write about telling your mom something funny from school.'
    ] },
    { words: ['爸爸'], meaning: 'dad', ideas: [
        'Write about learning a game from your dad.',
        'Write about cooking something with your dad.',
        'Write about asking your dad about his childhood.'
    ] },
    { words: ['哥哥'], meaning: 'older brother', ideas: [
        'Write about an older brother teaching a new game.',
        'Write about sharing a snack with an older brother.',
        'Write about an older brother helping find a lost toy.'
    ] },
    { words: ['姐姐'], meaning: 'older sister', ideas: [
        'Write about an older sister showing you a dance.',
        'Write about drawing a picture with an older sister.',
        'Write about an older sister telling a funny story.'
    ] },
    { words: ['弟弟'], meaning: 'younger brother', ideas: [
        'Write about helping a younger brother tie his shoes.',
        'Write about a younger brother building a block tower.',
        'Write about teaching a younger brother a new word.'
    ] },
    { words: ['妹妹'], meaning: 'younger sister', ideas: [
        'Write about reading a book to a younger sister.',
        'Write about a younger sister learning to ride a bike.',
        'Write about helping a younger sister find her toy.'
    ] },
    { words: ['朋友'], meaning: 'friend', ideas: [
        'Write about inviting a friend to play a new game.',
        'Write about helping a friend who dropped their pencils.',
        'Write about making a new friend on the playground.'
    ] },
    { words: ['好朋友'], meaning: 'good friend', ideas: [
        'Write about a good friend who makes you laugh.',
        'Write about a good friend helping you learn something new.',
        'Write about planning a surprise for a good friend.'
    ] },
    { words: ['老师', '老師'], meaning: 'teacher', ideas: [
        'Write about a teacher showing the class something surprising.',
        'Write about thanking a teacher for helping you.',
        'Write about asking your teacher an interesting question.'
    ] },
    { words: ['学校', '學校'], meaning: 'school', ideas: [
        'Write about your favorite place at school.',
        'Write about bringing something special to school.',
        'Write about showing a new student around your school.'
    ] },
    { words: ['学习', '學習'], meaning: 'learn / study', ideas: [
        'Write about learning to do something that used to be hard.',
        'Write about learning a new game from a friend.',
        'Write about something you want to learn about animals.'
    ] },
    { words: ['中文'], meaning: 'Chinese language', ideas: [
        'Write about teaching someone a Chinese word you know.',
        'Write about reading a Chinese story with your family.',
        'Write about spotting Chinese writing on a sign.'
    ] },
    { words: ['名字'], meaning: 'name', ideas: [
        'Write about choosing a name for an imaginary pet.',
        'Write about learning the name of a new classmate.',
        'Write about putting your name on something you made.'
    ] },
    { words: ['书', '書'], meaning: 'book', ideas: [
        'Write about choosing a book at the library.',
        'Write about lending your favorite book to a friend.',
        'Write about a surprising picture in a book.'
    ] },
    { words: ['写', '寫'], meaning: 'write', ideas: [
        'Write about writing a thank-you note to someone.',
        'Write about writing a secret message for a friend.',
        'Write about writing a list before a family trip.'
    ] },
    { words: ['读', '讀'], meaning: 'read', ideas: [
        'Write about reading a story to a younger child.',
        'Write about reading a sign to find your way.',
        'Write about reading in a cozy spot on a rainy day.'
    ] },
    { words: ['画', '畫'], meaning: 'draw / picture', ideas: [
        'Write about drawing an animal that does not exist.',
        'Write about making a picture for someone’s birthday.',
        'Write about drawing a map of your bedroom.'
    ] },
    { words: ['问题', '問題'], meaning: 'question / problem', ideas: [
        'Write about a question you want to ask a zookeeper.',
        'Write about a question you have after reading a story.',
        'Write about solving a tricky problem with a classmate.'
    ] },
    { words: ['回答'], meaning: 'answer', ideas: [
        'Write about answering a question in class.',
        'Write about answering a friend who asks about your pet.',
        'Write about finding the answer to a riddle.'
    ] },
    { words: ['故事'], meaning: 'story', ideas: [
        'Write about a story you want to hear again.',
        'Write about telling a funny story at dinner.',
        'Write about inventing a story about a lost robot.'
    ] },
    { words: ['生日'], meaning: 'birthday', ideas: [
        'Write about choosing a birthday surprise for a friend.',
        'Write about a game you want to play on your birthday.',
        'Write about making a birthday card for someone.'
    ] },
    { words: ['礼物', '禮物'], meaning: 'gift', ideas: [
        'Write about making a gift from things you already have.',
        'Write about opening a gift with an unusual shape.',
        'Write about choosing a gift for someone who likes animals.'
    ] },
    { words: ['时间', '時間'], meaning: 'time', ideas: [
        'Write about making time for your favorite game after homework.',
        'Write about checking the time before leaving for school.',
        'Write about wishing you had more time at the playground.'
    ] },
    // Everyday actions and things
    { words: ['吃'], meaning: 'eat', ideas: [
        'Write about eating a food you have never tried before.',
        'Write about eating your favorite breakfast before school.',
        'Write about eating a snack with a friend after playing.'
    ] },
    { words: ['喝'], meaning: 'drink', ideas: [
        'Write about drinking water after running around.',
        'Write about choosing something warm to drink on a cold day.',
        'Write about a pet drinking from its water bowl.'
    ] },
    { words: ['米饭', '米飯'], meaning: 'cooked rice', ideas: [
        'Write about eating rice with your favorite vegetables.',
        'Write about helping serve rice at dinner.',
        'Write about packing rice for a picnic lunch.'
    ] },
    { words: ['面包', '麵包'], meaning: 'bread', ideas: [
        'Write about smelling bread fresh from the oven.',
        'Write about making a sandwich with your favorite bread.',
        'Write about sharing a piece of bread at breakfast.'
    ] },
    { words: ['水果'], meaning: 'fruit', ideas: [
        'Write about choosing fruit for a colorful snack.',
        'Write about trying a fruit with an unusual shape.',
        'Write about sharing your favorite fruit at a picnic.'
    ] },
    { words: ['菜'], meaning: 'vegetable / dish', ideas: [
        'Write about helping wash vegetables before dinner.',
        'Write about tasting a new vegetable at lunch.',
        'Write about choosing vegetables to grow in a garden.'
    ] },
    { words: ['看'], meaning: 'look / watch', ideas: [
        'Write about watching a squirrel outside your window.',
        'Write about looking at old family photos.',
        'Write about watching a friend do a magic trick.'
    ] },
    { words: ['听', '聽'], meaning: 'listen / hear', ideas: [
        'Write about hearing a funny sound in the kitchen.',
        'Write about listening to a story before bed.',
        'Write about listening for birds on a quiet walk.'
    ] },
    { words: ['说', '說'], meaning: 'say / speak', ideas: [
        'Write about saying hello to a new neighbor.',
        'Write about telling someone the rules of a game.',
        'Write about saying something kind to a worried friend.'
    ] },
    { words: ['跑'], meaning: 'run', ideas: [
        'Write about running to catch a ball in the park.',
        'Write about running a race with a friend.',
        'Write about a puppy running toward its favorite person.'
    ] },
    { words: ['跳'], meaning: 'jump', ideas: [
        'Write about jumping over a puddle on a walk.',
        'Write about learning to jump rope with a friend.',
        'Write about a frog jumping into a pond.'
    ] },
    { words: ['走'], meaning: 'walk', ideas: [
        'Write about walking slowly to watch a tiny insect.',
        'Write about walking to school with someone you know.',
        'Write about taking a walk after dinner.'
    ] },
    { words: ['游泳'], meaning: 'swim', ideas: [
        'Write about learning a new skill at the swimming pool.',
        'Write about a duck swimming across a pond.',
        'Write about getting ready for a swim with your family.'
    ] },
    { words: ['玩'], meaning: 'play', ideas: [
        'Write about playing a board game on a rainy day.',
        'Write about inviting someone new to play with you.',
        'Write about playing with a toy you made yourself.'
    ] },
    { words: ['球'], meaning: 'ball', ideas: [
        'Write about a ball rolling into a surprising place.',
        'Write about learning to catch a ball.',
        'Write about choosing a ball game to play at recess.'
    ] },
    { words: ['唱歌'], meaning: 'sing', ideas: [
        'Write about singing a song with your class.',
        'Write about making up a song for a pet.',
        'Write about singing quietly while you tidy your room.'
    ] },
    { words: ['睡觉', '睡覺'], meaning: 'sleep', ideas: [
        'Write about a pet falling asleep beside you.',
        'Write about getting ready to sleep on a camping trip.',
        'Write about trying to sleep when you are excited about tomorrow.'
    ] },
    { words: ['帮忙', '幫忙'], meaning: 'help', ideas: [
        'Write about helping someone carry a heavy bag.',
        'Write about helping a classmate clean up a spill.',
        'Write about asking for help with a tricky puzzle.'
    ] },
    { words: ['做'], meaning: 'do / make', ideas: [
        'Write about making a paper animal for a friend.',
        'Write about doing a small job before dinner.',
        'Write about making something useful from an empty box.'
    ] },
    { words: ['找'], meaning: 'look for', ideas: [
        'Write about looking for a missing sock.',
        'Write about looking for a friend on the playground.',
        'Write about looking for a smooth stone beside a path.'
    ] },
    { words: ['买', '買'], meaning: 'buy', ideas: [
        'Write about buying a small gift with money you saved.',
        'Write about helping buy fruit at a market.',
        'Write about choosing a notebook to buy for school.'
    ] },
    { words: ['给', '給'], meaning: 'give', ideas: [
        'Write about giving a friend a handmade card.',
        'Write about giving a thirsty pet some water.',
        'Write about giving someone a turn with your favorite toy.'
    ] },
    { words: ['来', '來'], meaning: 'come', ideas: [
        'Write about a friend coming to your home to play.',
        'Write about a pet coming when you call its name.',
        'Write about a visitor coming to your classroom.'
    ] },
    { words: ['去'], meaning: 'go', ideas: [
        'Write about going to the library after school.',
        'Write about going somewhere new with your family.',
        'Write about going to the park to try a new game.'
    ] },
    { words: ['坐'], meaning: 'sit', ideas: [
        'Write about sitting next to a new classmate.',
        'Write about sitting under a tree to eat a snack.',
        'Write about a pet sitting on your favorite chair.'
    ] },
    { words: ['站'], meaning: 'stand', ideas: [
        'Write about standing in line for your favorite game.',
        'Write about standing on tiptoe to see over a fence.',
        'Write about standing beside a friend in a class photo.'
    ] },
    { words: ['开门', '開門'], meaning: 'open a door', ideas: [
        'Write about opening the door for a visitor.',
        'Write about opening a door and finding a surprise.',
        'Write about holding a door open for someone carrying books.'
    ] },
    { words: ['关门', '關門'], meaning: 'close a door', ideas: [
        'Write about closing a door quietly while someone sleeps.',
        'Write about closing a door to keep a pet inside.',
        'Write about closing the door before leaving home.'
    ] },
    { words: ['车', '車'], meaning: 'vehicle / car', ideas: [
        'Write about spotting a brightly colored car on a trip.',
        'Write about packing the car for a family picnic.',
        'Write about building a toy car from blocks.'
    ] },
    { words: ['飞机', '飛機'], meaning: 'airplane', ideas: [
        'Write about seeing tiny houses from an airplane.',
        'Write about watching an airplane take off.',
        'Write about a place you would like to visit by airplane.'
    ] },
    { words: ['路'], meaning: 'road / way', ideas: [
        'Write about something interesting on the way to school.',
        'Write about choosing a new route for a family walk.',
        'Write about finding your way with a map.'
    ] },
    { words: ['手'], meaning: 'hand', ideas: [
        'Write about washing paint off your hands.',
        'Write about holding someone’s hand on a walk.',
        'Write about using your hands to make a shadow animal.'
    ] },
    { words: ['眼睛'], meaning: 'eyes', ideas: [
        'Write about a cat’s eyes shining in the dark.',
        'Write about closing your eyes to guess a mystery sound.',
        'Write about opening your eyes to see a birthday surprise.'
    ] },
    { words: ['口'], meaning: 'mouth', ideas: [
        'Write about opening your mouth wide at the dentist.',
        'Write about taking a small mouthful of a new food.',
        'Write about a baby bird opening its mouth for food.'
    ] },
    { words: ['衣服'], meaning: 'clothes', ideas: [
        'Write about picking clothes for a rainy day.',
        'Write about folding clean clothes with your family.',
        'Write about clothes you would wear to a costume party.'
    ] },
    // Feelings and descriptions
    { words: ['爱', '愛'], meaning: 'love', ideas: [
        'Write about showing someone in your family that you love them.',
        'Write about an activity you love doing with a friend.',
        'Write about caring for an animal you love.'
    ] },
    { words: ['喜欢', '喜歡'], meaning: 'like', ideas: [
        'Write about a food you like and what makes it tasty.',
        'Write about a game you like playing with your family.',
        'Write about a place you like to visit after school.'
    ] },
    { words: ['快乐', '快樂'], meaning: 'happy', ideas: [
        'Write about feeling happy when a friend invites you to play.',
        'Write about a happy moment during a family trip.',
        'Write about something small that made you happy today.'
    ] },
    { words: ['开心', '開心'], meaning: 'happy / delighted', ideas: [
        'Write about feeling happy after finishing something difficult.',
        'Write about a surprise that makes you smile.',
        'Write about making someone happy with a kind action.'
    ] },
    { words: ['难过', '難過'], meaning: 'sad', ideas: [
        'Write about feeling sad when a favorite toy breaks.',
        'Write about helping a friend who feels sad.',
        'Write about feeling sad when a fun visit ends.'
    ] },
    { words: ['生气', '生氣'], meaning: 'angry', ideas: [
        'Write about feeling angry when someone knocks down your tower.',
        'Write about what helps you calm down when you are angry.',
        'Write about an angry character in a story you know.'
    ] },
    { words: ['害怕'], meaning: 'afraid', ideas: [
        'Write about feeling afraid before trying something new.',
        'Write about a strange noise that turns out to be harmless.',
        'Write about helping someone who is afraid of a small insect.'
    ] },
    { words: ['笑'], meaning: 'laugh / smile', ideas: [
        'Write about a pet doing something that makes you laugh.',
        'Write about sharing a funny joke with a friend.',
        'Write about smiling when you see someone you missed.'
    ] },
    { words: ['想'], meaning: 'think / want / miss', ideas: [
        'Write about something you want to learn this year.',
        'Write about thinking of a surprise for a friend.',
        'Write about missing someone who lives far away.'
    ] },
    { words: ['希望'], meaning: 'hope', ideas: [
        'Write about hoping for good weather on a picnic day.',
        'Write about something you hope to learn at school.',
        'Write about hoping a friend can come to play.'
    ] },
    { words: ['觉得', '覺得'], meaning: 'think / feel', ideas: [
        'Write about what you think of a new game.',
        'Write about how you feel after a long walk.',
        'Write about what you think is the best part of a school day.'
    ] },
    { words: ['知道'], meaning: 'know', ideas: [
        'Write about knowing where to find your favorite library book.',
        'Write about a surprising animal fact you know.',
        'Write about finding out something you did not know before.'
    ] },
    { words: ['大'], meaning: 'big', ideas: [
        'Write about a box big enough to hide inside.',
        'Write about seeing a very big dog on a walk.',
        'Write about building the biggest tower you can.'
    ] },
    { words: ['小'], meaning: 'small', ideas: [
        'Write about a tiny shell you find at the beach.',
        'Write about a small gift that makes someone happy.',
        'Write about a little animal hiding under a leaf.'
    ] },
    { words: ['好'], meaning: 'good', ideas: [
        'Write about a good idea for cheering up a friend.',
        'Write about a good day you had at school.',
        'Write about something a friend is good at doing.'
    ] },
    { words: ['新'], meaning: 'new', ideas: [
        'Write about trying out a new pair of shoes.',
        'Write about welcoming a new classmate.',
        'Write about learning the rules of a new game.'
    ] },
    { words: ['长', '長'], meaning: 'long / grow', ideas: [
        'Write about an animal with a very long tail.',
        'Write about a plant growing taller on your windowsill.',
        'Write about waiting in a long line with a friend.'
    ] },
    { words: ['高'], meaning: 'tall / high', ideas: [
        'Write about a kite flying high above the park.',
        'Write about a tall tree near your home.',
        'Write about building a tower taller than your toy animals.'
    ] },
    { words: ['多'], meaning: 'many / much', ideas: [
        'Write about seeing many birds in one tree.',
        'Write about having many ideas for a birthday game.',
        'Write about finding lots of shells on a beach.'
    ] },
    { words: ['少'], meaning: 'few / little', ideas: [
        'Write about a day when only a few children are at the park.',
        'Write about saving a little paint to finish a picture.',
        'Write about a tree with only a few leaves left.'
    ] },
    { words: ['红', '紅'], meaning: 'red', ideas: [
        'Write about a red balloon floating above a party.',
        'Write about choosing a red apple for a snack.',
        'Write about a red leaf you find on a walk.'
    ] },
    { words: ['白'], meaning: 'white', ideas: [
        'Write about a white rabbit hiding in snow.',
        'Write about drawing on a fresh sheet of white paper.',
        'Write about spotting a white cloud shaped like a boat.'
    ] },
    { words: ['黑'], meaning: 'black', ideas: [
        'Write about a black cat with bright eyes.',
        'Write about finding your black shoes before school.',
        'Write about drawing the night sky with a black crayon.'
    ] },
    { words: ['绿', '綠'], meaning: 'green', ideas: [
        'Write about new green leaves on a plant.',
        'Write about a green frog beside a pond.',
        'Write about choosing green paper for a craft.'
    ] },
    { words: ['蓝', '藍'], meaning: 'blue', ideas: [
        'Write about a bright blue sky after a storm.',
        'Write about a blue toy you take on a trip.',
        'Write about mixing paint to make the blue of the sea.'
    ] },
    { words: ['黄', '黃'], meaning: 'yellow', ideas: [
        'Write about a yellow flower growing beside a fence.',
        'Write about a yellow leaf drifting to the ground.',
        'Write about choosing a yellow hat for a sunny day.'
    ] },
    { words: ['冷'], meaning: 'cold', ideas: [
        'Write about cold hands warming up around a mug.',
        'Write about stepping outside on a cold morning.',
        'Write about a cold treat on a summer afternoon.'
    ] },
    { words: ['热', '熱'], meaning: 'hot', ideas: [
        'Write about letting hot soup cool before eating.',
        'Write about finding shade on a hot day.',
        'Write about feeling hot after running a race.'
    ] },
    // Trips, journals and memories
    { words: ['游记', '遊記', '游記'], meaning: 'travel journal / account of a trip', ideas: [
        'Write about a place from a family outing you would describe in a travel journal.',
        'Write about a surprising moment you would include in a travel journal about a school trip.',
        'Write about a travel journal you would like to read and the place it describes.'
    ] },
    { words: ['日记', '日記'], meaning: 'diary', ideas: [
        'Write about one moment from today you want to put in your diary.',
        'Write about where you like to sit when you write in your diary.',
        'Write about finding an old diary entry about your first day of school.'
    ] },
    { words: ['笔记', '筆記'], meaning: 'notes', ideas: [
        'Write about taking notes while watching a seed grow.',
        'Write about a drawing you added to your science notes.',
        'Write about using your notes to remember what a teacher explained.'
    ] },
    { words: ['记录', '記錄'], meaning: 'record / write down', ideas: [
        'Write about recording how much rain falls each day.',
        'Write about writing down the names of birds you see on a walk.',
        'Write about keeping a record of the books you finish this month.'
    ] },
    { words: ['记得', '記得'], meaning: 'remember', ideas: [
        'Write about a funny moment you still remember from a trip.',
        'Write about remembering to bring something important to school.',
        'Write about a game you remember playing when you were younger.'
    ] },
    { words: ['忘记', '忘記'], meaning: 'forget', ideas: [
        'Write about forgetting an umbrella on a rainy day.',
        'Write about something you do so you will not forget your homework.',
        'Write about forgetting the rules of a game and asking a friend.'
    ] },
    { words: ['回忆', '回憶'], meaning: 'recall / memory', ideas: [
        'Write about a happy memory that comes back when you look at a photo.',
        'Write about remembering a visit with someone you have not seen lately.',
        'Write about sharing a memory from your first school trip.'
    ] },
    { words: ['经历', '經歷'], meaning: 'experience / go through', ideas: [
        'Write about your experience of trying a new sport for the first time.',
        'Write about an experience on a trip that taught you something.',
        'Write about a surprising experience you want to tell a friend about.'
    ] },
    { words: ['旅行'], meaning: 'travel / trip', ideas: [
        'Write about something you would pack for a trip to the mountains.',
        'Write about a person you would like to travel with.',
        'Write about something unexpected that happened during a trip.'
    ] },
    { words: ['旅游', '旅遊'], meaning: 'travel for pleasure / sightseeing', ideas: [
        'Write about a place you would like to visit on vacation.',
        'Write about trying a local food while sightseeing with your family.',
        'Write about choosing between two places for a vacation.'
    ] },
    { words: ['假期'], meaning: 'vacation / school break', ideas: [
        'Write about something you want to learn during a school break.',
        'Write about a quiet vacation day spent at home.',
        'Write about a person you hope to visit during your vacation.'
    ] },
    { words: ['周末', '週末'], meaning: 'weekend', ideas: [
        'Write about a weekend plan you are looking forward to.',
        'Write about helping with something at home on the weekend.',
        'Write about a rainy weekend when your plans changed.'
    ] },
    { words: ['计划', '計劃'], meaning: 'plan', ideas: [
        'Write about making a plan for a class picnic.',
        'Write about planning how to finish a project before Friday.',
        'Write about changing your plan because a friend has a new idea.'
    ] },
    { words: ['准备', '準備'], meaning: 'prepare / get ready', ideas: [
        'Write about getting your backpack ready for a school trip.',
        'Write about preparing a small surprise for a friend.',
        'Write about getting ready to speak in front of your class.'
    ] },
    { words: ['出发', '出發'], meaning: 'set off / depart', ideas: [
        'Write about leaving early for a trip while it is still dark.',
        'Write about what your family checks before setting off.',
        'Write about how you feel when the bus departs on a school trip.'
    ] },
    { words: ['到达', '到達'], meaning: 'arrive / reach', ideas: [
        'Write about the first thing you see when you arrive at a campsite.',
        'Write about reaching the top of a hill after a long walk.',
        'Write about arriving at a relative\'s home for a visit.'
    ] },
    { words: ['参观', '參觀'], meaning: 'visit / tour a place', ideas: [
        'Write about touring a museum and finding your favorite exhibit.',
        'Write about visiting a farm to see how vegetables grow.',
        'Write about a place you would like your class to visit.'
    ] },
    { words: ['介绍', '介紹'], meaning: 'introduce / tell someone about', ideas: [
        'Write about introducing a new friend to your family.',
        'Write about telling a visitor about your favorite place at school.',
        'Write about introducing a book you enjoyed to your class.'
    ] },
    { words: ['地方'], meaning: 'place', ideas: [
        'Write about a place where you like to read quietly.',
        'Write about a place you would show a friend visiting your town.',
        'Write about a place that looks different at night.'
    ] },
    { words: ['城市'], meaning: 'city', ideas: [
        'Write about something you notice while walking through a city.',
        'Write about a city you would like to visit and why.',
        'Write about a park surrounded by busy city streets.'
    ] },
    { words: ['乡村', '鄉村'], meaning: 'countryside / village', ideas: [
        'Write about the sounds you might hear on a morning in the countryside.',
        'Write about visiting a small village surrounded by fields.',
        'Write about something you would like to do in the countryside.'
    ] },
    { words: ['公园', '公園'], meaning: 'park', ideas: [
        'Write about choosing a spot for a picnic in a park.',
        'Write about something interesting you notice on a park path.',
        'Write about a game you play with friends at the park.'
    ] },
    { words: ['博物馆', '博物館'], meaning: 'museum', ideas: [
        'Write about a museum exhibit you wish you could learn more about.',
        'Write about a question you would ask a museum guide.',
        'Write about which museum you would choose for a class visit.'
    ] },
    { words: ['动物园', '動物園'], meaning: 'zoo', ideas: [
        'Write about an animal you would like to observe at a zoo.',
        'Write about a zoo keeper explaining how an animal is cared for.',
        'Write about something new you learned during a zoo visit.'
    ] },

    // Observing places and describing experiences
    { words: ['植物'], meaning: 'plant', ideas: [
        'Write about a plant you would like to grow on a windowsill.',
        'Write about two plants with very different leaves.',
        'Write about caring for a plant while a neighbor is away.'
    ] },
    { words: ['动物', '動物'], meaning: 'animal', ideas: [
        'Write about an animal you spotted near your home.',
        'Write about an animal that stays awake at night.',
        'Write about choosing an animal to learn more about for a project.'
    ] },
    { words: ['自然'], meaning: 'nature / natural', ideas: [
        'Write about something in nature that makes you curious.',
        'Write about taking a nature walk after it rains.',
        'Write about a sound from nature you enjoy hearing.'
    ] },
    { words: ['环境', '環境'], meaning: 'environment / surroundings', ideas: [
        'Write about keeping the environment around your school clean.',
        'Write about the kind of environment a frog needs to live in.',
        'Write about how your surroundings change when you leave a city.'
    ] },
    { words: ['保护', '保護'], meaning: 'protect', ideas: [
        'Write about protecting a tiny plant from being stepped on.',
        'Write about a way your class could protect a nearby stream.',
        'Write about using a cover to protect a library book from rain.'
    ] },
    { words: ['风景', '風景'], meaning: 'scenery / view', ideas: [
        'Write about the view from a train window.',
        'Write about scenery you would like to paint.',
        'Write about how the view from a hill changes in winter.'
    ] },
    { words: ['景色'], meaning: 'scenery', ideas: [
        'Write about the colors in the scenery beside a lake.',
        'Write about scenery you noticed during a walk with your family.',
        'Write about the scenery outside your window at sunset.'
    ] },
    { words: ['景点', '景點'], meaning: 'scenic spot / visitor attraction', ideas: [
        'Write about a visitor attraction you would recommend in your town.',
        'Write about choosing which scenic spot to visit first on a trip.',
        'Write about a famous attraction you want to see in person.'
    ] },
    { words: ['海边', '海邊'], meaning: 'seaside', ideas: [
        'Write about the sounds you hear during a walk by the sea.',
        'Write about flying a kite at the seaside.',
        'Write about what you would pack for a day by the sea.'
    ] },
    { words: ['沙滩', '沙灘'], meaning: 'beach / sandy shore', ideas: [
        'Write about building something in the sand at a beach.',
        'Write about finding unusual footprints on a sandy beach.',
        'Write about how the beach looks after the tide goes out.'
    ] },
    { words: ['照片'], meaning: 'photograph', ideas: [
        'Write about a photo that reminds you of a funny moment.',
        'Write about choosing a photo to put in a class display.',
        'Write about what is happening just outside the edge of a photo.'
    ] },
    { words: ['纪念', '紀念'], meaning: 'commemorate / keep as a reminder', ideas: [
        'Write about keeping a ticket as a reminder of a special trip.',
        'Write about planting a tree to mark a special day.',
        'Write about making a card to remember your last day in a class.'
    ] },
    { words: ['观察', '觀察'], meaning: 'observe / watch carefully', ideas: [
        'Write about something you notice while observing ants at work.',
        'Write about watching a seedling carefully for changes each day.',
        'Write about what you notice when you observe clouds moving.'
    ] },
    { words: ['发现', '發現'], meaning: 'discover / notice', ideas: [
        'Write about discovering a tiny flower growing through a crack.',
        'Write about noticing a clue that helps you find a lost toy.',
        'Write about discovering something unexpected inside an old box.'
    ] },
    { words: ['变化', '變化'], meaning: 'change', ideas: [
        'Write about how a tree changes as autumn arrives.',
        'Write about changes in your neighborhood since you were younger.',
        'Write about watching ice change as it warms up.'
    ] },
    { words: ['比较', '比較'], meaning: 'compare / relatively', ideas: [
        'Write about comparing two routes to the playground.',
        'Write about comparing leaves from two different trees.',
        'Write about which of two books is easier for you to read.'
    ] },
    { words: ['特别', '特別'], meaning: 'special / especially', ideas: [
        'Write about a gift that is special to you and why.',
        'Write about a day when you felt especially excited.',
        'Write about something special your family does together.'
    ] },
    { words: ['有趣'], meaning: 'interesting / fun', ideas: [
        'Write about an interesting fact you learned about an animal.',
        'Write about a fun game you invented with a friend.',
        'Write about an interesting object you found on a walk.'
    ] },
    { words: ['美丽', '美麗'], meaning: 'beautiful', ideas: [
        'Write about something beautiful you notice in an ordinary place.',
        'Write about the colors that make a garden beautiful.',
        'Write about a beautiful view you want to show someone.'
    ] },
    { words: ['安静', '安靜'], meaning: 'quiet', ideas: [
        'Write about a quiet place where you like to think.',
        'Write about a classroom becoming quiet when a story begins.',
        'Write about walking quietly so you can watch a bird.'
    ] },
    { words: ['热闹', '熱鬧'], meaning: 'lively / bustling', ideas: [
        'Write about the lively sounds at a school fair.',
        'Write about a busy market full of people and food stalls.',
        'Write about a lively family gathering during a holiday.'
    ] },
    { words: ['激动', '激動'], meaning: 'excited / emotionally moved', ideas: [
        'Write about feeling excited when you see someone you have missed.',
        'Write about how you feel when your team scores at the last moment.',
        'Write about feeling moved by a surprise someone prepared for you.'
    ] },
    { words: ['感受'], meaning: 'feelings / experience', ideas: [
        'Write about your feelings after trying something difficult.',
        'Write about how you feel when you stand beside the sea.',
        'Write about sharing your feelings after a class trip.'
    ] },
    { words: ['原因'], meaning: 'reason / cause', ideas: [
        'Write about the reason you chose a certain library book.',
        'Write about figuring out why a classroom plant is drooping.',
        'Write about the reason your family changed its weekend plans.'
    ] },

    // Schoolwork, problem solving and reflection
    { words: ['结果', '結果'], meaning: 'result / outcome', ideas: [
        'Write about the result of growing two plants in different places.',
        'Write about a game whose result surprised you.',
        'Write about what happened as a result of practicing every day.'
    ] },
    { words: ['决定', '決定'], meaning: 'decide / decision', ideas: [
        'Write about deciding what to do with a free afternoon.',
        'Write about a decision your group makes before starting a project.',
        'Write about deciding to try again after something goes wrong.'
    ] },
    { words: ['选择', '選擇'], meaning: 'choose / choice', ideas: [
        'Write about choosing one book from a shelf full of interesting books.',
        'Write about choosing a game that everyone in your group can play.',
        'Write about choosing what to bring on a short trip.'
    ] },
    { words: ['学生', '學生'], meaning: 'student', ideas: [
        'Write about a new student finding a place to sit at lunch.',
        'Write about students working together to decorate a classroom.',
        'Write about something a student could do to welcome a visitor.'
    ] },
    { words: ['同学', '同學'], meaning: 'classmate', ideas: [
        'Write about a classmate who taught you a new game.',
        'Write about helping a classmate find a missing pencil.',
        'Write about making a plan with classmates for a school event.'
    ] },
    { words: ['教室'], meaning: 'classroom', ideas: [
        'Write about your favorite corner of the classroom.',
        'Write about how your classroom looks before everyone arrives.',
        'Write about something you would like to add to your classroom.'
    ] },
    { words: ['作业', '作業'], meaning: 'homework / school assignment', ideas: [
        'Write about an assignment that let you interview a family member.',
        'Write about choosing a quiet place to do your homework.',
        'Write about what you do when a homework question puzzles you.'
    ] },
    { words: ['完成'], meaning: 'finish / complete', ideas: [
        'Write about how you feel after finishing a difficult puzzle.',
        'Write about completing a class project with your group.',
        'Write about what you plan to do after you finish a drawing.'
    ] },
    { words: ['认真', '認真'], meaning: 'careful / serious about a task', ideas: [
        'Write about listening carefully to instructions for a new game.',
        'Write about carefully checking a drawing before giving it as a gift.',
        'Write about taking your job of caring for a class plant seriously.'
    ] },
    { words: ['努力'], meaning: 'work hard / make an effort', ideas: [
        'Write about working hard to learn a song you enjoy.',
        'Write about the effort your team puts into building a model.',
        'Write about something you want to improve and how you practice.'
    ] },
    { words: ['进步', '進步'], meaning: 'make progress / improve', ideas: [
        'Write about noticing progress in your handwriting.',
        'Write about a skill that has improved since last year.',
        'Write about a small improvement that makes you proud.'
    ] },
    { words: ['帮助', '幫助'], meaning: 'help', ideas: [
        'Write about helping a younger child learn a game.',
        'Write about someone who helped you understand a tricky question.',
        'Write about offering help when a friend drops a pile of books.'
    ] },
    { words: ['合作'], meaning: 'cooperate / work together', ideas: [
        'Write about working together to build a bridge from blocks.',
        'Write about how your group shares jobs while making a poster.',
        'Write about a game that needs everyone to cooperate.'
    ] },
    { words: ['解决', '解決'], meaning: 'solve / resolve', ideas: [
        'Write about solving the problem of a tower that keeps falling.',
        'Write about resolving a disagreement over which game to play.',
        'Write about finding a way to keep your school papers organized.'
    ] },
    { words: ['办法', '辦法'], meaning: 'method / way to deal with something', ideas: [
        'Write about a way to remember what to pack for school.',
        'Write about finding a way to carry several books at once.',
        'Write about a new way to stop a paper boat from tipping over.'
    ] },
    { words: ['坚持', '堅持'], meaning: 'persist / keep at something', ideas: [
        'Write about keeping up your practice of a new skill.',
        'Write about continuing a difficult puzzle after taking a break.',
        'Write about a friend who keeps trying to learn a dance.'
    ] },
    { words: ['安全'], meaning: 'safe / safety', ideas: [
        'Write about crossing a street safely with your family.',
        'Write about choosing a safe place to fly a kite.',
        'Write about something you check before riding your bicycle.'
    ] },
    { words: ['重要'], meaning: 'important', ideas: [
        'Write about an important item you check for before leaving home.',
        'Write about why listening to a teammate is important.',
        'Write about a day that is important to your family.'
    ] },
    { words: ['终于', '終於'], meaning: 'finally / at last', ideas: [
        'Write about finally learning to do something after many tries.',
        'Write about a long-awaited visitor finally arriving.',
        'Write about finally finding something you had lost.'
    ] },
    { words: ['虽然', '雖然'], meaning: 'although / even though', ideas: [
        'Write about enjoying a picnic even though the weather was cloudy.',
        'Write about a small gift that means a lot to you.',
        'Write about joining a game even though you feel shy.'
    ] },
    { words: ['可是'], meaning: 'but / however', ideas: [
        'Write about wanting to play outside but finding that it is raining.',
        'Write about a box that looks heavy but is actually empty.',
        'Write about planning to draw one thing but changing your mind.'
    ] },
    { words: ['应该', '應該'], meaning: 'should / ought to', ideas: [
        'Write about what you should do if you find a lost library book.',
        'Write about how players should treat each other during a game.',
        'Write about something you think your class should try together.'
    ] },
    { words: ['愿意', '願意'], meaning: 'be willing to / would like to', ideas: [
        'Write about being willing to try an unfamiliar food.',
        'Write about volunteering to help a friend practice a song.',
        'Write about something you would like to do for your community.'
    ] },
    { words: ['相信'], meaning: 'believe / trust', ideas: [
        'Write about believing a friend will keep a promise.',
        'Write about believing you can learn a difficult skill.',
        'Write about hearing a surprising story and deciding whether to believe it.'
    ] },

    // Useful sentence words: ideas still leave the wording to the child.
    { words: ['我'], meaning: 'I / me', ideas: [
        'Write about something you are proud of learning.',
        'Write about what you would do with a free afternoon.',
        'Write about your favorite part of today.'
    ] },
    { words: ['你'], meaning: 'you', ideas: [
        'Write a question asking a friend about their favorite game.',
        'Write about something you want to tell a visiting friend.',
        'Write a message inviting someone to play with you.'
    ] },
    { words: ['他'], meaning: 'he / him', ideas: [
        'Write about a boy teaching a friend a new trick.',
        'Write about a boy looking for his lost hat.',
        'Write about a boy helping set the table.'
    ] },
    { words: ['她'], meaning: 'she / her', ideas: [
        'Write about a girl building a model airplane.',
        'Write about a girl finding a surprising stone.',
        'Write about a girl helping a new student feel welcome.'
    ] },
    { words: ['它'], meaning: 'it', ideas: [
        'Write about an animal doing something funny.',
        'Write about a toy that has a special place in your room.',
        'Write about a plant growing a new leaf.'
    ] },
    { words: ['我们', '我們'], meaning: 'we / us', ideas: [
        'Write about a game you and a friend invented.',
        'Write about something your class does together.',
        'Write about a meal you help your family prepare.'
    ] },
    { words: ['人'], meaning: 'person / people', ideas: [
        'Write about a person who helps in your neighborhood.',
        'Write about people waiting for a bus on a rainy day.',
        'Write about meeting someone with an interesting hobby.'
    ] },
    { words: ['的'], meaning: 'links a description or owner to something', ideas: [
        'Write about a friend’s colorful backpack.',
        'Write about the soft ears of a rabbit.',
        'Write about a toy that belongs to someone in your family.'
    ] },
    { words: ['了'], meaning: 'can mark a completed action or a change', ideas: [
        'Write about finishing a puzzle after working hard.',
        'Write about a flower that has just opened.',
        'Write about getting home after a long trip.'
    ] },
    { words: ['在'], meaning: 'at / in / doing', ideas: [
        'Write about where your pet likes to sleep.',
        'Write about what a friend is doing at the playground.',
        'Write about reading in your favorite place.'
    ] },
    { words: ['有'], meaning: 'have / there is', ideas: [
        'Write about something unusual you have in your backpack.',
        'Write about what is inside a picnic basket.',
        'Write about an animal that has a long tail.'
    ] },
    { words: ['是'], meaning: 'be / is', ideas: [
        'Write about who your best teammate is.',
        'Write about which day is your favorite day of the week.',
        'Write about what an unfamiliar object really is.'
    ] },
    { words: ['不'], meaning: 'not', ideas: [
        'Write about a food you do not like and why.',
        'Write about a pet that does not want a bath.',
        'Write about a game you do not know how to play yet.'
    ] },
    { words: ['没有', '沒有'], meaning: 'do not have / there is not', ideas: [
        'Write about getting ready to draw but having no pencil.',
        'Write about a playground with nobody on it.',
        'Write about making a game without any toys.'
    ] },
    { words: ['也'], meaning: 'also / too', ideas: [
        'Write about two friends who like the same game.',
        'Write about wanting to join a game someone else is playing.',
        'Write about a family member who shares your favorite food.'
    ] },
    { words: ['都'], meaning: 'all / both', ideas: [
        'Write about everyone in your class enjoying the same game.',
        'Write about two pets that are both asleep.',
        'Write about putting all your toys away.'
    ] },
    { words: ['很'], meaning: 'very / a degree word before a description', ideas: [
        'Write about how tired you feel after a long hike.',
        'Write about how sweet a ripe piece of fruit tastes.',
        'Write about how tall a tree near your school is.'
    ] },
    { words: ['会', '會'], meaning: 'can / know how to', ideas: [
        'Write about a skill you can teach a friend.',
        'Write about a surprising trick a pet can do.',
        'Write about something you can do now that you once could not.'
    ] },
    { words: ['能'], meaning: 'can / be able to', ideas: [
        'Write about what you can build with a small box.',
        'Write about an animal that can see in the dark.',
        'Write about how far you can throw a ball.'
    ] },
    { words: ['要'], meaning: 'want / need', ideas: [
        'Write about what you need to take on a picnic.',
        'Write about a game you want to play after school.',
        'Write about what a plant needs to grow.'
    ] },
    { words: ['和'], meaning: 'and / with', ideas: [
        'Write about two foods you enjoy eating together.',
        'Write about playing with a friend after school.',
        'Write about two animals sharing a shady spot.'
    ] },
    { words: ['比'], meaning: 'compare', ideas: [
        'Write about comparing the heights of two block towers.',
        'Write about which of two bags feels heavier.',
        'Write about how today’s weather compares with yesterday’s.'
    ] },
    { words: ['因为', '因為'], meaning: 'because', ideas: [
        'Write about why you chose a certain book to read.',
        'Write about why a pet is hiding under a chair.',
        'Write about why you want to visit a particular place.'
    ] },
    { words: ['所以'], meaning: 'so / therefore', ideas: [
        'Write about what you do because it starts raining at recess.',
        'Write about what you do after noticing a plant is thirsty.',
        'Write about a change of plans because a friend is away.'
    ] },
    { words: ['但是'], meaning: 'but', ideas: [
        'Write about wanting to play outside when it is raining.',
        'Write about a small dog with a surprisingly loud bark.',
        'Write about a game that is difficult and still fun.'
    ] },
    { words: ['如果'], meaning: 'if', ideas: [
        'Write about what you would do if you could fly.',
        'Write about what you would pack if you went camping.',
        'Write about what you would play if a friend visited.'
    ] },
    { words: ['然后', '然後'], meaning: 'then / after that', ideas: [
        'Write about washing a piece of fruit and then eating it.',
        'Write about building a paper boat and then trying it in water.',
        'Write about finishing homework and then choosing a game.'
    ] },
    { words: ['一起'], meaning: 'together', ideas: [
        'Write about building something together with a friend.',
        'Write about your family cooking a meal together.',
        'Write about classmates working together to tidy the room.'
    ] },
    { words: ['上'], meaning: 'up / on', ideas: [
        'Write about a cat sleeping on a chair.',
        'Write about putting a special drawing on the wall.',
        'Write about climbing up a hill to see the view.'
    ] },
    { words: ['里', '裡', '裏'], meaning: 'inside', ideas: [
        'Write about a surprise inside a box.',
        'Write about what you keep inside your school bag.',
        'Write about an animal hiding inside a hollow tree.'
    ] },
    { words: ['外'], meaning: 'outside', ideas: [
        'Write about a sound coming from outside your window.',
        'Write about leaving muddy shoes outside the door.',
        'Write about playing outside after a rainy morning.'
    ] },
    { words: ['前'], meaning: 'before / in front', ideas: [
        'Write about what you do before leaving for school.',
        'Write about a tree in front of your home.',
        'Write about getting everything ready before a friend visits.'
    ] },
    { words: ['明天'], meaning: 'tomorrow', ideas: [
        'Write about something you are looking forward to tomorrow.',
        'Write about getting your bag ready for tomorrow.',
        'Write about a plan to help someone tomorrow.'
    ] },
    { words: ['今天'], meaning: 'today', ideas: [
        'Write about something new you tried today.',
        'Write about the most surprising thing you saw today.',
        'Write about someone you helped today.'
    ] },
    { words: ['昨天'], meaning: 'yesterday', ideas: [
        'Write about a game you played yesterday.',
        'Write about something funny that happened yesterday.',
        'Write about how yesterday’s weather changed your plans.'
    ] },
    { words: ['早'], meaning: 'early', ideas: [
        'Write about waking up early for a special trip.',
        'Write about arriving early and helping set up a game.',
        'Write about a bird singing early in the morning.'
    ] },
    { words: ['晚'], meaning: 'late / evening', ideas: [
        'Write about a quiet activity you enjoy in the evening.',
        'Write about getting home late after a special outing.',
        'Write about seeing lights turn on as evening arrives.'
    ] },
    { words: ['年'], meaning: 'year', ideas: [
        'Write about something you learned this year.',
        'Write about how you have changed since last year.',
        'Write about a family tradition for the new year.'
    ] },
    { words: ['国', '國'], meaning: 'country', ideas: [
        'Write about a country you would like to visit.',
        'Write about learning a game from another country.',
        'Write about a food from a country you are curious about.'
    ] },
    { words: ['二'], meaning: 'two', ideas: [
        'Write about what happens on the second day of a trip.',
        'Write about finishing second in a friendly race.',
        'Write about an animal living on the second floor of an imaginary house.'
    ] },
    { words: ['两', '兩'], meaning: 'two (a quantity)', ideas: [
        'Write about two friends sharing a snack.',
        'Write about choosing between two books.',
        'Write about two birds sitting on a fence.'
    ] },
    { words: ['三'], meaning: 'three', ideas: [
        'Write about three friends inventing a game.',
        'Write about choosing three things to take on a picnic.',
        'Write about a cat finding three empty boxes.'
    ] },
    { words: ['四'], meaning: 'four', ideas: [
        'Write about four people playing a board game.',
        'Write about drawing an animal with four legs.',
        'Write about sharing four pieces of fruit with a friend.'
    ] },
    { words: ['五'], meaning: 'five', ideas: [
        'Write about five children building a sandcastle.',
        'Write about collecting five colorful leaves.',
        'Write about spending five minutes on a favorite game.'
    ] },
    { words: ['六'], meaning: 'six', ideas: [
        'Write about putting six crayons in a pencil case.',
        'Write about counting the six legs of an insect.',
        'Write about six friends choosing teams for a game.'
    ] },
    { words: ['七'], meaning: 'seven', ideas: [
        'Write about keeping track of a plant for seven days.',
        'Write about finding seven shells on a beach.',
        'Write about seven little ducks following their mother.'
    ] },
    { words: ['八'], meaning: 'eight', ideas: [
        'Write about noticing a spider’s eight legs.',
        'Write about building something with eight blocks.',
        'Write about eight children making a circle for a game.'
    ] },
    { words: ['九'], meaning: 'nine', ideas: [
        'Write about a nine-year-old learning a new skill.',
        'Write about finding nine marbles under a sofa.',
        'Write about drawing nine stars on a birthday card.'
    ] },
    { words: ['十'], meaning: 'ten', ideas: [
        'Write about counting to ten during hide-and-seek.',
        'Write about using ten blocks to build a bridge.',
        'Write about ten minutes you spent doing something fun.'
    ] }
];

const CHARACTER_IDEAS_BY_CHARACTER = new Map();
const CHARACTER_IDEAS_BY_WORD = new Map();
for (const entry of CHARACTER_IDEAS) {
    const word = entry.words[0];
    for (const form of entry.words) {
        if ([...form].length === 1) continue;
        const cards = CHARACTER_IDEAS_BY_WORD.get(form) || [];
        cards.push(...entry.ideas.map(text => ({
            strategy: word, word, meaning: entry.meaning, text
        })));
        CHARACTER_IDEAS_BY_WORD.set(form, cards);
    }
    for (const character of new Set(entry.words.join(''))) {
        const cards = CHARACTER_IDEAS_BY_CHARACTER.get(character) || [];
        cards.push(...entry.ideas.map(text => ({
            strategy: word, word, meaning: entry.meaning, text
        })));
        CHARACTER_IDEAS_BY_CHARACTER.set(character, cards);
    }
}

function ideasForText(text) {
    // A single character can suggest a word containing it. Compounds must
    // match a listed form as a whole, without splitting into characters.
    // All returned words use the simplified form, including for alias input.
    const index = [...text].length === 1 ? CHARACTER_IDEAS_BY_CHARACTER : CHARACTER_IDEAS_BY_WORD;
    return index.get(text) || [];
}
