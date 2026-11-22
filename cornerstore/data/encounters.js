// Corner Store encounters. Everything here is fictional: people, brands, the neighbourhood.
// Each encounter: { id, cat: everyday|chaos|hustle|danger, weight, cond(ctx), anywhere, here, cast: { main: {...}, ... },
//   start, nodes: { id: { who, say, pose, sfx, hold, timer, timeout, enter(c), options: [{ tone, text, if(c), do(c), next, end }] } } }
// `end` says what the main character does after: leave | browse | flee | steal | hostile | loiter | stay.
// The context `c` is built in game.js (makeCtx): c.sell, c.pocket, c.spend, c.respect, c.mood, c.note, c.flag, c.has, c.police, ...

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const money = (n) => '$' + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '');

// ------------------------------------------------------------------ plain customers (the endless filler, each a little different)
const FIRST = ['Keem', 'Tasha', 'Dre', 'Nae', 'Rell', 'Mook', 'Bree', 'Saleem', 'Jaz', 'Tone', 'Ms. Pat', 'Unc', 'Shay', 'Boo', 'Quan', 'Lexi', 'Hakim', 'Dom', 'Kiki', 'Pooh', 'Mr. Earl', 'Yusuf', 'Marisol', 'Tia'];
const ITEMS = [
  ['a quarter water', 0.5], ['a hoagie from the case', 8], ['hot chips', 1.5], ['a pack of Menthol Kings', 11], ['two grape wraps', 2], ['a cigarillo', 1.25],
  ['a 40', 4.5], ['a six of Larch Lager', 11], ['an iced tea', 1.25], ['diapers', 14], ['a lighter', 1.5], ['sunflower seeds', 1.25], ['a pickle', 1.5],
  ['ramen', 1], ['a scratch-off', 5], ['a Butterkrunch cake', 1.5], ['an energy drink', 3], ['3 piece chicken', 6], ['condoms', 6], ['a phone charger', 9],
  ['a lemonade', 1.25], ['Tylenol', 4], ['a honey bun', 1.25], ['a pack of gum', 1], ['two loosies', 1, true],
];
const GREET = {
  regular: ['Wassup, wassup.', 'You good tonight?', 'Ayo.', 'Same as always.', 'Long night, huh?'],
  yn: ['Ayo bul.', 'Ayo lemme get—', 'Yo, you got change for a fifty?', 'Ayyye.'],
  nurse: ['Please be quick.', 'Twelve-hour shift. Hi.', 'Hey hon.'],
  worker: ['Just got off.', 'Ay boss.', 'Quick one.'],
  drunk: ['HEYYY it\'s my guy!', 'Wha—what time is it?', 'Sir. SIR. I love this store.'],
  tourist: ['Hi! Um. Hi.', 'Is this... open?', 'Oh wow, a real corner store!'],
  kid: ['Hi.', 'How much is...', 'Yo can I get...'],
  driver: ['Running late, real quick.', 'Yo, fast please.'],
  church: ['Bless you, baby.', 'Good morning— well. Night.'],
  unhoused: ['Hey neighbor.', 'You got hot water?'],
};
export const CUSTOMER_KINDS = [
  { kind: 'regular', name: () => pick(FIRST), look: () => ({ outfit: pick(['hoodie', 'puffer', 'tee', 'track']) }) },
  { kind: 'regular', name: () => pick(FIRST), look: () => ({ outfit: pick(['hoodie', 'puffer', 'tee', 'track']) }) },
  { kind: 'yn', name: () => pick(['Lil ' + pick(['Saint', 'Ju', 'Moe', 'Bam', 'Tay']), 'Youngbol', 'Jayden']), look: () => ({ outfit: pick(['hoodie', 'puffer', 'track']) }), height: () => 1.6 + Math.random() * 0.2 },
  { kind: 'nurse', name: () => pick(['Ms. Carla', 'Nurse Tee', 'Rochelle']), look: () => ({ outfit: 'scrubs', female: true }) },
  { kind: 'worker', name: () => pick(['Big Mike', 'Hector', 'Wes']), look: () => ({ outfit: 'work' }) },
  { kind: 'drunk', name: () => pick(['Ronnie', 'Big Ray', 'Cheryl']), drunk: true, look: () => ({ outfit: pick(['tee', 'hoodie']) }) },
  { kind: 'driver', name: () => pick(['Rashid', 'Delivery Guy', 'Marco']), look: () => ({ outfit: 'puffer' }) },
  { kind: 'kid', name: () => pick(['Lil Man', 'Nyla', 'Kev']), look: () => ({ outfit: pick(['hoodie', 'tee']) }), height: () => 1.35 + Math.random() * 0.15, voice: 1.6 },
];

export function makeCustomerEncounter(npc, world) {
  const n = 1 + Math.floor(Math.random() * 3), basket = [];
  const pool = ITEMS.filter(i => !i[2] || npc.kind !== 'kid');
  while (basket.length < n) { const it = pick(pool); if (!basket.includes(it)) basket.push(it); }
  const total = basket.reduce((s, i) => s + i[1], 0);
  const loosie = basket.some(i => i[2]);
  const list = basket.map(i => i[0]).join(', ').replace(/, ([^,]*)$/, ' and $1');
  const skim = Math.max(1, Math.round(total * (0.25 + Math.random() * 0.15)));
  const gouge = Math.max(1, Math.round(total * 0.4));
  const short = Math.random() < 0.2 && npc.kind !== 'tourist' ? Math.min(total - 0.25, pick([0.5, 1, 1.5, 2])) : 0;
  const weird = pick([
    ['That\'ll be your soul. Kidding. ' + money(total) + '.', 'Haha... why you say it like that?'],
    ['Do you ever think the fridges are watching us?', 'I do now. Thanks.'],
    ['I\'m not really the cashier. I\'m his twin.', 'Then tell your twin he owe me a dollar.'],
    ['Ring ring. Who\'s there? ' + money(total) + '.', 'That\'s not how that joke go.'],
    ['Good choice. Bold choice. Brave choice.', 'It\'s just ' + list + ', bro.'],
    ['Shhh. The cat is sleeping.', '...the cat is literally staring at me.'],
  ]);
  const greet = pick(GREET[npc.kind] || GREET.regular);
  const c = {
    id: 'customer', cat: 'everyday',
    start: short ? 'short' : 'start',
    nodes: {
      start: {
        say: `${greet} Lemme get ${list}.`,
        options: [
          { tone: 'friendly', text: `Ring it up. ${money(total)}.`, do: (c) => { c.sell(total); c.mood(1); if (Math.random() < 0.25 + world.respect / 200) { c.pocket(1 + Math.floor(Math.random() * 3), 'tip'); c.bark(c.npc, 'Keep the change.'); } }, end: 'leave' },
          { tone: 'hustle', text: `Ring up ${money(total - skim)}, pocket ${money(skim)}.`, do: (c) => { c.sell(total, { skim }); }, end: 'leave' },
          { tone: 'sarcastic', text: `That's ${money(total + gouge)}. Inflation.`, next: () => Math.random() < (npc.kind === 'tourist' || npc.kind === 'drunk' ? 0.85 : 0.45) ? 'paysGouge' : 'argue' },
          { tone: 'weird', text: weird[0], do: (c) => { c.sell(total); }, next: 'weird' },
          ...(loosie ? [{ tone: 'shady', text: 'Loosies off the books. Two dollars for two.', do: (c) => { c.sell(total - 1); c.pocket(2); }, end: 'leave' }] : []),
        ],
      },
      short: {
        say: `${greet} Lemme get ${list}... I'm like ${money(short)} short. You could look out?`,
        options: [
          { tone: 'friendly', text: 'I got you. Go ahead.', do: (c) => { c.sell(total - short); c.respect(1); c.mood(2); }, end: 'leave' },
          { tone: 'passive', text: 'Put something back then.', do: (c) => { c.sell(total - basket[0][1]); }, end: 'leave' },
          { tone: 'dismissive', text: 'No money, no jawn.', do: (c) => { c.mood(-2); c.respect(-1); }, next: 'noMoney' },
          { tone: 'hustle', text: `Pay me back tomorrow. With interest.`, do: (c) => { c.sell(total - short); c.flag('owed_' + npc.name, true); }, end: 'leave' },
        ],
      },
      noMoney: {
        say: pick(['Wow. WOW. Over a dollar?', 'Aight. I remember faces.', 'That\'s crazy. Bet.']), pose: 'angry', sfx: 'scoff',
        options: [
          { tone: 'passive', text: 'Have a good night.', end: 'leave' },
          { tone: 'sarcastic', text: 'Remember mine then.', do: (c) => { c.mood(-1); }, end: 'leave' },
        ],
      },
      paysGouge: {
        say: pick(['Damn. Everything going up.', 'For real? ...Aight.', 'Philly is so expensive now.']), pose: 'shrug',
        options: [
          { tone: 'passive', text: 'It is what it is.', do: (c) => { c.sell(total, { gouge }); }, end: 'leave' },
          { tone: 'sarcastic', text: 'Blame the economy.', do: (c) => { c.sell(total, { gouge }); }, end: 'leave' },
        ],
      },
      argue: {
        say: `${money(total + gouge)}?? The sign literally say ${money(total)}. You tryna play me?`, pose: 'angry', sfx: 'scoff',
        options: [
          { tone: 'passive', text: `My bad, my bad. ${money(total)}.`, do: (c) => { c.sell(total); c.mood(-1); }, end: 'leave' },
          { tone: 'aggressive', text: 'Price is the price. Pay or bounce.', do: (c) => { c.mood(-3); c.respect(-2); }, next: () => Math.random() < 0.35 ? 'grabs' : 'leaves' },
          { tone: 'clever', text: 'The sign is old. Look how faded it is.', next: () => Math.random() < 0.5 ? 'paysGouge' : 'leaves' },
        ],
      },
      leaves: { say: 'I\'m going to the other store.', pose: 'angry', options: [{ tone: 'passive', text: 'Bye.', end: 'leave' }, { tone: 'sarcastic', text: 'They closed.', end: 'leave' }] },
      grabs: {
        say: '(grabs the stuff off the counter and walks out)', pose: 'angry', sfx: 'scoff',
        options: [
          { tone: 'aggressive', text: 'YO!', do: (c) => { c.loss(total); c.note(`${npc.name} walked out with ${list}`); }, end: 'steal' },
          { tone: 'passive', text: 'Let it go.', do: (c) => { c.loss(total); c.respect(-2); }, end: 'steal' },
          { tone: 'shady', text: 'Call the cops on them.', do: (c) => { c.loss(total); c.wild(c.npc, 2); c.police('a customer walked out without paying'); }, end: 'steal' },
        ],
      },
      weird: {
        say: weird[1], pose: Math.random() < 0.5 ? 'laugh' : 'shrug', sfx: Math.random() < 0.5 ? 'laugh' : 'hmm',
        options: [
          { tone: 'weird', text: 'We\'ll never know.', end: 'leave' },
          { tone: 'friendly', text: 'Just playing. Have a good night.', do: (c) => c.mood(1), end: 'leave' },
        ],
      },
    },
  };
  return c;
}

// ------------------------------------------------------------------ scripted encounters
export const ENCOUNTERS = [
  {
    id: 'lotto_prophet', cat: 'everyday', weight: 1.2, repeat: true,
    cast: { main: { kind: 'regular', name: 'Mr. Lenny', rid: 'lenny', look: { outfit: 'tee', hat: 'cap' }, height: 1.7, voice: 0.85, browse: 1 } },
    start: 'start',
    nodes: {
      start: {
        say: (c) => c.mem.met ? (c.mem.flags?.won ? 'You KNOW the dreams work now. Seven, seven, banana again.' : 'Back again. The dream came back, man. Seven, seven, banana.') : 'I dreamt the numbers. Seven, seven, banana. Ring me up a Pick 3.',
        sfx: 'hmm', enter: (c) => c.remember({ met: (c.mem.met || 0) + 1 }),
        options: [
          { tone: 'friendly', text: 'Banana ain\'t a number, but I respect it.', do: (c) => { c.sell(2); c.mood(2); }, next: 'buys' },
          { tone: 'sarcastic', text: 'Last week you dreamt I owed you money.', do: (c) => c.mood(-1), next: 'argues' },
          { tone: 'weird', text: 'I dreamt that too. You lose.', next: 'spooked' },
          { tone: 'hustle', text: 'Dreams cost extra. Five dollars.', do: (c) => { c.sell(2, { gouge: 3 }); }, next: 'buys' },
          { tone: 'dismissive', text: 'Machine\'s broke, Lenny.', next: 'broke' },
        ],
      },
      buys: { say: 'When I hit, I\'m buying this whole store. And firing you. Respectfully.', pose: 'laugh', sfx: 'laugh', options: [{ tone: 'friendly', text: 'Respectfully received.', end: 'leave' }, { tone: 'sarcastic', text: 'You\'ve been hitting for 30 years, Lenny.', end: 'leave' }] },
      argues: { say: 'You DID owe me money. In the dream. That counts in the spirit world.', pose: 'point', options: [{ tone: 'clever', text: 'Then I\'ll pay you in the spirit world.', do: (c) => { c.sell(2); }, end: 'leave' }, { tone: 'aggressive', text: 'Get out the spirit world and pay, man.', do: (c) => { c.sell(2); c.mood(-1); }, end: 'leave' }] },
      spooked: { say: '...What you mean I lose? Who told you about the dream?', pose: 'shrug', sfx: 'gasp', options: [{ tone: 'weird', text: '(stare at him without blinking)', do: (c) => { c.flag('lennySpooked', true); }, end: 'flee' }, { tone: 'friendly', text: 'I\'m playing. Here\'s your ticket.', do: (c) => c.sell(2), end: 'leave' }] },
      broke: { say: 'The machine is RIGHT THERE making noise. It\'s working. I can hear it working.', pose: 'angry', options: [{ tone: 'passive', text: 'Aight, it\'s working. $2.', do: (c) => c.sell(2), end: 'leave' }, { tone: 'dismissive', text: 'That\'s just the fridge.', do: (c) => c.mood(-2), end: 'leave' }] },
    },
  },
  {
    id: 'quarter_kid', cat: 'everyday', weight: 1,
    cast: { main: { kind: 'kid', name: 'Lil Man', height: 1.38, voice: 1.7, look: { outfit: 'hoodie' }, browse: 1 } },
    nodes: {
      start: {
        say: 'Can I get a blue quarter water and... how much the hot chips? I got 85 cents.', sfx: 'hmm',
        options: [
          { tone: 'friendly', text: 'Take both. I got you.', do: (c) => { c.sell(0.85); c.respect(2); }, end: 'leave' },
          { tone: 'passive', text: 'Juice is 50, chips is a dollar fifty. Pick one.', do: (c) => c.sell(0.5), end: 'leave' },
          { tone: 'clever', text: 'Why you out at 2 in the morning, little man?', next: 'why' },
          { tone: 'dismissive', text: 'No money, no jawn.', do: (c) => { c.respect(-2); }, end: 'leave' },
        ],
      },
      why: {
        say: 'My mom work nights. I\'m watching my sister. She wanted hot chips.', pose: 'shrug',
        options: [
          { tone: 'friendly', text: 'Here. Take a hoagie too. On me.', if: (c) => c.stash >= 8, do: (c) => { c.spend(8); c.sell(0.85); c.respect(5); c.flag('helpedKid', true); c.note('Looked out for Lil Man and his sister'); }, end: 'leave' },
          { tone: 'passive', text: 'Aight. Go straight home.', do: (c) => c.sell(0.85), end: 'leave' },
          { tone: 'sarcastic', text: 'So she the boss of you?', next: 'boss' },
        ],
      },
      boss: { say: 'She\'s four. She the boss of everybody.', pose: 'laugh', sfx: 'laugh', options: [{ tone: 'friendly', text: 'Respect. Take the chips.', do: (c) => { c.sell(0.85); c.respect(2); }, end: 'leave' }, { tone: 'weird', text: 'Tell her I said she\'s doing a great job.', do: (c) => c.sell(0.85), end: 'leave' }] },
    },
  },
  {
    id: 'nurse', cat: 'everyday', weight: 1,
    cast: { main: { kind: 'nurse', name: 'Ms. Carla', rid: 'carla', look: { outfit: 'scrubs', female: true }, browse: 1, voice: 1.2 } },
    nodes: {
      start: {
        say: (c) => c.mem.met ? 'You again. Good. Don\'t talk to me. Coffee and the big chips.' : 'Twelve hours. Don\'t talk to me. Just the coffee and the biggest bag of chips you got.', sfx: 'sigh',
        enter: (c) => c.remember({ met: (c.mem.met || 0) + 1 }),
        options: [
          { tone: 'friendly', text: 'Coffee\'s on me tonight.', if: (c) => c.stash >= 2, do: (c) => { c.spend(2); c.sell(2.75); c.remember({ mood: 3 }); }, next: 'thanks' },
          { tone: 'passive', text: 'That\'s $4.75.', do: (c) => c.sell(4.75), end: 'leave' },
          { tone: 'weird', text: 'Rough night? Somebody die?', next: 'die' },
          { tone: 'hustle', text: 'Ring up $3, pocket the rest.', do: (c) => c.sell(4.75, { skim: 1.75 }), end: 'leave' },
        ],
      },
      thanks: { say: 'You\'re a good one. If you ever get shot in here, ask for me at Penn.', pose: 'laugh', sfx: 'laugh', options: [{ tone: 'friendly', text: 'Hopefully never. But thanks.', end: 'leave' }, { tone: 'weird', text: 'Can I book that now?', end: 'leave' }] },
      die: { say: '...Yes. Somebody did. Can I just have my chips.', pose: 'hurt', sfx: 'sigh', options: [{ tone: 'friendly', text: 'I\'m sorry. Here, no charge on the coffee.', if: (c) => c.stash >= 2, do: (c) => { c.spend(2); c.sell(2.75); c.respect(2); }, end: 'leave' }, { tone: 'passive', text: '$4.75.', do: (c) => c.sell(4.75), end: 'leave' }] },
    },
  },
  {
    id: 'conspiracy', cat: 'everyday', weight: 0.8,
    cast: { main: { kind: 'regular', name: 'Professor Dee', look: { outfit: 'puffer', hat: 'beanie' }, voice: 0.9, browse: 2 } },
    nodes: {
      start: {
        say: 'The pigeons on 52nd are government. You know that, right? I need double-A batteries for my jammer.', pose: 'point', sfx: 'hmm',
        options: [
          { tone: 'passive', text: 'Batteries are six dollars.', do: (c) => c.sell(6), end: 'leave' },
          { tone: 'clever', text: 'Pigeons can\'t be government. Government is too slow to fly.', next: 'slow' },
          { tone: 'weird', text: 'I knew it. Which ones? The fat ones?', next: 'fat' },
          { tone: 'dismissive', text: 'Get out with that, Dee.', do: (c) => c.mood(-2), end: 'leave' },
        ],
      },
      slow: { say: '...Huh. That\'s actually a good point. Now I gotta rethink everything.', pose: 'shrug', options: [{ tone: 'friendly', text: 'Batteries still six dollars.', do: (c) => c.sell(6), end: 'leave' }, { tone: 'weird', text: 'Start with the squirrels.', do: (c) => c.sell(6), end: 'leave' }] },
      fat: { say: 'THE FAT ONES. You see it too. Here, a dollar for you. Stay woke, brother.', pose: 'laugh', sfx: 'laugh', options: [{ tone: 'weird', text: '(salute him)', do: (c) => { c.sell(6); c.pocket(1, 'tip'); c.flag('deeFriend', true); }, end: 'leave' }, { tone: 'sarcastic', text: 'Only a dollar? For pigeon intel?', do: (c) => { c.sell(6); c.pocket(1, 'tip'); }, end: 'leave' }] },
    },
  },
  {
    id: 'driver', cat: 'everyday', weight: 0.9,
    cast: { main: { kind: 'driver', name: 'Rashid', look: { outfit: 'puffer' }, hold: 'phone', direct: true } },
    nodes: {
      start: {
        say: 'Bro please. I got four minutes on this order and I REALLY gotta use the bathroom.', pose: 'phone', sfx: 'grunt',
        options: [
          { tone: 'dismissive', text: 'Bathroom\'s employees only.', next: 'begs' },
          { tone: 'friendly', text: 'Go ahead, it\'s in the back. Hurry.', do: (c) => { c.respect(2); c.note('Let the delivery driver use the bathroom'); }, next: 'thanks' },
          { tone: 'hustle', text: 'Five dollars for the key.', do: (c) => c.pocket(5), next: 'thanks' },
          { tone: 'weird', text: 'The bathroom is a state of mind.', next: 'begs' },
        ],
      },
      begs: { say: 'Don\'t do this to me. My rating is 4.98. FOUR NINETY EIGHT.', pose: 'angry', options: [{ tone: 'friendly', text: 'Fine. Go.', do: (c) => c.respect(1), next: 'thanks' }, { tone: 'passive', text: 'Gas station on the corner.', do: (c) => c.mood(-2), end: 'flee' }] },
      thanks: { say: 'You a real one. I\'m tipping you five stars on my heart.', pose: 'laugh', sfx: 'laugh', options: [{ tone: 'friendly', text: 'Go, go.', end: 'leave' }, { tone: 'sarcastic', text: 'Hearts don\'t pay rent.', end: 'leave' }] },
    },
  },
  {
    id: 'church_lady', cat: 'everyday', weight: 0.8,
    cast: { main: { kind: 'church', name: 'Sister Bernice', look: { outfit: 'church', female: true }, voice: 1.15, browse: 1, speed: 0.8 } },
    nodes: {
      start: {
        say: 'Baby, you look like you need Jesus and a raffle ticket. Five dollars. It\'s for the choir robes.', sfx: 'hmm',
        options: [
          { tone: 'friendly', text: 'I\'ll take one, Sister.', if: (c) => c.stash >= 5, do: (c) => { c.spend(5); c.respect(3); c.note('Bought a raffle ticket from Sister Bernice'); }, next: 'bless' },
          { tone: 'passive', text: 'I\'m good, Sister.', next: 'pray' },
          { tone: 'weird', text: 'Do I win Jesus?', next: 'win' },
          { tone: 'shady', text: 'Can I sell YOU something? I got stuff under the counter.', next: 'shady' },
        ],
      },
      bless: { say: 'God sees you working these nights. And so do I. Lock that door, baby.', options: [{ tone: 'friendly', text: 'Yes ma\'am.', end: 'leave' }, { tone: 'weird', text: 'Which door?', end: 'leave' }] },
      pray: { say: 'Then I\'ll pray for you for free. Lord, protect this child from these crazy people.', pose: 'talk', options: [{ tone: 'friendly', text: 'Amen.', do: (c) => c.respect(1), end: 'leave' }, { tone: 'sarcastic', text: 'Pray for the drawer too.', end: 'leave' }] },
      win: { say: 'Boy. You already got Jesus. You win a ham.', pose: 'laugh', sfx: 'laugh', options: [{ tone: 'friendly', text: 'A whole ham? Fine. Five dollars.', if: (c) => c.stash >= 5, do: (c) => { c.spend(5); c.respect(2); }, end: 'leave' }, { tone: 'passive', text: 'I\'m vegetarian, Sister.', end: 'leave' }] },
      shady: {
        say: '...What kind of stuff.', pose: 'shrug',
        options: [
          { tone: 'shady', text: 'Loosies. Two for a dollar.', do: (c) => { c.pocket(1); c.note('Sold Sister Bernice two loosies. Tell nobody.'); }, next: 'secret' },
          { tone: 'friendly', text: 'Kidding! Kidding. God bless.', end: 'leave' },
        ],
      },
      secret: { say: 'This stays between me, you and the Lord.', options: [{ tone: 'friendly', text: 'Lips sealed.', end: 'leave' }, { tone: 'weird', text: 'And the cameras.', do: (c) => c.mood(-1), end: 'leave' }] },
    },
  },
  {
    id: 'tourists', cat: 'everyday', weight: 0.7,
    cast: {
      main: { kind: 'tourist', name: 'Brad', look: { outfit: 'tourist', female: false, hat: 'cap' }, browse: 1 },
      kelsey: { kind: 'tourist', name: 'Kelsey', look: { outfit: 'tourist', female: true }, browse: 1, voice: 1.3 },
    },
    nodes: {
      start: {
        say: 'Hi! Is this... safe? We\'re looking for the art museum steps? Our hotel is in Center City.', sfx: 'hmm',
        options: [
          { tone: 'friendly', text: 'You\'re like four miles away. Get an Uber. Now.', do: (c) => c.respect(1), next: 'buy' },
          { tone: 'weird', text: 'Sure. Right down the block. Can\'t miss it.', do: (c) => c.note('Sent two tourists the wrong way'), next: 'wrong' },
          { tone: 'hustle', text: 'Directions are twenty dollars.', do: (c) => c.pocket(20), next: 'pays' },
          { tone: 'dismissive', text: 'Buy something or bounce.', next: 'buy' },
        ],
      },
      buy: {
        who: 'kelsey', say: 'Can we get two waters and... what is a "quarter water"?',
        options: [
          { tone: 'friendly', text: 'A Philly classic. Fifty cents. Waters are two each.', do: (c) => c.sell(4.5), end: 'leave' },
          { tone: 'hustle', text: 'Tourist water. Six each.', do: (c) => c.sell(4, { gouge: 8 }), end: 'leave' },
          { tone: 'weird', text: 'It\'s a quarter of a water. You need four to make one.', do: (c) => c.sell(4.5), next: 'four' },
        ],
      },
      four: { who: 'kelsey', say: 'Oh my god, Brad, get four.', sfx: 'laugh', pose: 'laugh', options: [{ tone: 'friendly', text: 'Four quarter waters. Two dollars.', do: (c) => c.sell(2), end: 'leave' }, { tone: 'sarcastic', text: 'Welcome to Philly.', end: 'leave' }] },
      wrong: { say: 'Great! Thank you SO much! Philly people are so nice!', pose: 'laugh', options: [{ tone: 'weird', text: 'We\'re the nicest.', end: 'leave' }, { tone: 'friendly', text: '...Wait. Actually, get an Uber.', do: (c) => c.respect(1), end: 'leave' }] },
      pays: { say: 'Oh! Um. Okay. Is that... normal here?', options: [{ tone: 'clever', text: 'Totally normal. Uber, four miles, that way.', end: 'leave' }, { tone: 'sarcastic', text: 'Tipping is also normal.', do: (c) => c.pocket(5, 'tip'), end: 'leave' }] },
    },
  },
  {
    id: 'streamer', cat: 'chaos', weight: 1,
    cast: { main: { kind: 'streamer', name: 'Kayy (LIVE)', look: { outfit: 'puffer', female: true }, hold: 'phone', idlePose: 'film', direct: true, voice: 1.25 } },
    nodes: {
      start: {
        say: 'Chat says you look like that dude from that one movie. Say something for my 40K followers! We LIVE!', pose: 'film', sfx: 'laugh',
        options: [
          { tone: 'friendly', text: 'What\'s good, Philly!', do: (c) => { c.respect(3); c.note('Went live on Kayy\'s stream'); }, next: 'chat' },
          { tone: 'dismissive', text: 'No filming in the store.', next: 'mad' },
          { tone: 'weird', text: '(deliver a three-minute speech about the price of eggs)', do: (c) => { c.respect(6); c.flag('viral', true); c.note('Went viral for the egg speech'); }, next: 'viral' },
          { tone: 'hustle', text: 'Appearance fee. Twenty dollars.', next: () => Math.random() < 0.5 ? 'pays' : 'mad' },
          { tone: 'aggressive', text: '(grab the phone)', if: (c) => !c.inBooth, do: (c) => { c.respect(-5); c.wild(c.npc, 2); }, next: 'grab' },
        ],
      },
      chat: { say: 'Chat is going CRAZY. Somebody asking if you single. Somebody asking if you got Takis.', pose: 'film', options: [{ tone: 'friendly', text: 'Yes and yes.', end: 'leave' }, { tone: 'sarcastic', text: 'Tell chat to come buy something.', end: 'leave' }] },
      viral: { say: 'OH MY GOD. That\'s going on everything. You famous now, the egg guy!', pose: 'laugh', sfx: 'laugh', options: [{ tone: 'weird', text: 'Eggs are a scam.', end: 'leave' }, { tone: 'friendly', text: 'Tag the store.', end: 'leave' }] },
      pays: { say: 'Okay, okay, PAID. Chat, he\'s a businessman. Respect it.', options: [{ tone: 'hustle', text: 'Pleasure doing business.', do: (c) => c.pocket(20), end: 'leave' }, { tone: 'friendly', text: 'Keep it, I was playing.', do: (c) => c.respect(2), end: 'leave' }] },
      mad: { say: 'Chat, he\'s HATING. Corner store guy is a hater. Rate this store one star!', pose: 'angry', sfx: 'scoff', options: [{ tone: 'passive', text: 'Okay.', do: (c) => c.respect(-2), end: 'leave' }, { tone: 'aggressive', text: 'Get out my store.', do: (c) => c.respect(-3), end: 'leave' }] },
      grab: { say: 'AYYYY HE GRABBED MY PHONE! YOU SEEING THIS?!', pose: 'angry', sfx: 'scream', options: [{ tone: 'passive', text: '(give it back)', end: 'flee' }, { tone: 'aggressive', text: '(toss it out the door)', do: (c) => c.respect(-4), end: 'flee' }] },
    },
  },
  {
    id: 'drunk_couple', cat: 'chaos', weight: 1,
    cast: {
      main: { kind: 'drunk', name: 'Tasha', drunk: true, look: { outfit: 'tee', female: true }, voice: 1.25, direct: true },
      mike: { kind: 'drunk', name: 'Mike', drunk: true, look: { outfit: 'hoodie' }, voice: 0.9, direct: true },
    },
    nodes: {
      start: {
        say: 'TELL HIM. Tell him a hoagie is NOT a sandwich. You work here. You the expert.', pose: 'point', sfx: 'laugh',
        options: [
          { tone: 'passive', text: 'It\'s... a sandwich.', next: 'mikeWins' },
          { tone: 'friendly', text: 'A hoagie is a hoagie. It\'s its own thing.', next: 'tashaWins' },
          { tone: 'dismissive', text: 'Y\'all need to go home.', next: 'home' },
          { tone: 'aggressive', text: 'Fight about it outside.', next: 'fight' },
          { tone: 'weird', text: 'Hoagies are a state of mind.', next: 'mind' },
        ],
      },
      mikeWins: { who: 'mike', say: 'HA. HAAA. I been saying it for three years!', pose: 'laugh', sfx: 'laugh', options: [{ tone: 'passive', text: 'Okay, okay, buy something.', do: (c) => { c.sell(9); c.bark(c.npc, 'I\'m sleeping at my mom\'s.'); }, end: 'leave' }, { tone: 'sarcastic', text: 'Three years of this?', do: (c) => c.sell(4.5), end: 'leave' }] },
      tashaWins: { say: 'THANK YOU. Get me a 40 for my win. He paying.', pose: 'laugh', sfx: 'laugh', options: [{ tone: 'friendly', text: '$4.50.', do: (c) => c.sell(4.5), end: 'leave' }, { tone: 'hustle', text: 'Victory 40s are seven dollars.', do: (c) => c.sell(4.5, { gouge: 2.5 }), end: 'leave' }] },
      home: { who: 'mike', say: 'We ARE home. This store is our home. You is family.', pose: 'talk', options: [{ tone: 'friendly', text: 'Then family says go to sleep.', end: 'leave' }, { tone: 'sarcastic', text: 'Family pays for stuff.', do: (c) => c.sell(4.5), end: 'leave' }] },
      fight: { say: 'Oh you think I won\'t?!', pose: 'angry', sfx: 'scream', enter: (c) => { c.fight(c.npc, c.cast.mike); }, options: [{ tone: 'passive', text: '...I didn\'t mean literally.', end: 'stay' }, { tone: 'shady', text: 'Call the cops.', do: (c) => c.police('a drunk couple fighting in the store'), end: 'stay' }] },
      mind: { who: 'mike', say: '...Babe. Babe. He\'s right. We was fighting over nothing. Everything is a hoagie.', pose: 'talk', options: [{ tone: 'weird', text: 'Everything is a hoagie.', do: (c) => { c.sell(8); c.respect(2); c.note('Saved a relationship with hoagie philosophy'); }, end: 'leave' }, { tone: 'friendly', text: 'Buy a hoagie and share it.', do: (c) => c.sell(8), end: 'leave' }] },
    },
  },
  {
    id: 'miss_dee', cat: 'everyday', weight: 0.9, repeat: true,
    cast: { main: { kind: 'unhoused', name: 'Miss Dee', rid: 'dee', look: { outfit: 'ragged', female: true, hat: 'beanie' }, voice: 1.1, speed: 0.75, browse: 1 } },
    nodes: {
      start: {
        say: (c) => c.mem.met ? 'Hey baby, it\'s me again. You got that hot water? I\'ll sweep, I don\'t mind.' : 'Hey neighbor. Could I get some hot water for my noodles? I can sweep for it.',
        sfx: 'hmm', enter: (c) => c.remember({ met: (c.mem.met || 0) + 1 }),
        options: [
          { tone: 'friendly', text: 'Hot water\'s free, Miss Dee. Here.', do: (c) => { c.respect(2); c.remember({ mood: 2 }); }, next: 'thanks' },
          { tone: 'clever', text: 'Sweep up by the fridges and I\'ll throw in a hoagie.', do: (c) => { c.choreDone('mop'); c.spend(Math.min(8, c.stash)); c.respect(3); c.note('Miss Dee swept the floor'); }, next: 'thanks' },
          { tone: 'passive', text: 'Not tonight, Dee.', next: 'ok' },
          { tone: 'dismissive', text: 'No loitering. Sign\'s right there.', do: (c) => { c.respect(-4); c.remember({ mood: -3 }); }, next: 'hurt' },
        ],
      },
      thanks: { say: 'You good people. I\'ll tell the young boys to leave your store alone.', pose: 'talk', options: [{ tone: 'friendly', text: 'Appreciate you, Dee.', do: (c) => c.flag('deeProtects', true), end: 'leave' }, { tone: 'weird', text: 'Tell them I know karate.', end: 'leave' }] },
      ok: { say: 'Okay, baby. Tomorrow.', sfx: 'sigh', options: [{ tone: 'friendly', text: 'Tomorrow.', end: 'leave' }, { tone: 'passive', text: '(nod)', end: 'leave' }] },
      hurt: { say: 'I been on this block longer than this store. Remember that.', pose: 'point', options: [{ tone: 'passive', text: '...', end: 'leave' }, { tone: 'friendly', text: 'You\'re right. I\'m sorry. Come back tomorrow.', do: (c) => c.respect(2), end: 'leave' }] },
    },
  },
  {
    id: 'yn_group', cat: 'chaos', weight: 1.1,
    cast: {
      main: { kind: 'yn', name: 'Lil Saint', look: { outfit: 'puffer' }, swagger: true, height: 1.68, browse: 1 },
      ju: { kind: 'yn', name: 'Ju', look: { outfit: 'hoodie' }, swagger: true, height: 1.64, browse: 2, hold: 'phone' },
      bam: { kind: 'yn', name: 'Bam', look: { outfit: 'track' }, height: 1.72, browse: 2 },
    },
    nodes: {
      start: {
        say: 'Ayo lemme get two grape wraps and the hot chips. And a lighter. Ju, what you want? JU.', sfx: 'laugh', pose: 'talk',
        options: [
          { tone: 'passive', text: 'Six bucks. ID for the wraps.', next: 'id' },
          { tone: 'sarcastic', text: 'Y\'all look like you\'re in 8th grade.', do: (c) => c.mood(-2), next: 'grade' },
          { tone: 'hustle', text: 'Y\'all want loosies too? Off the books.', do: (c) => { c.sell(6); c.pocket(2); }, next: 'loosies' },
          { tone: 'dismissive', text: 'Tell your boy to stop filming.', next: 'film' },
        ],
      },
      id: { say: 'ID?? Bro I\'m 25. I got a mortgage. I got a 401k.', pose: 'shrug', sfx: 'scoff', options: [{ tone: 'friendly', text: 'Aight, Mr. 401k. Six dollars.', do: (c) => c.sell(6), end: 'leave' }, { tone: 'clever', text: 'What\'s a 401k then?', next: 'k401' }, { tone: 'dismissive', text: 'No ID, no wraps.', do: (c) => c.sell(2.5), next: () => Math.random() < 0.4 ? 'steal' : 'whatever' }] },
      k401: { say: '...It\'s like a... it\'s a bank thing. Bam, what\'s a 401k?', pose: 'shrug', options: [{ tone: 'friendly', text: 'Just take the chips, man.', do: (c) => { c.sell(1.5); c.respect(1); }, end: 'leave' }, { tone: 'sarcastic', text: 'That\'s what I thought.', do: (c) => c.sell(1.5), end: 'leave' }] },
      grade: { who: 'bam', say: 'OHHHHH he cooked you, Saint! He COOKED you!', pose: 'laugh', sfx: 'laugh', options: [{ tone: 'friendly', text: 'I\'m playing. Six dollars.', do: (c) => c.sell(6), end: 'leave' }, { tone: 'sarcastic', text: 'Bring your mom next time.', do: (c) => c.mood(-2), next: 'steal' }] },
      loosies: { say: 'Oh you a real one. You the plug of the corner store.', pose: 'laugh', options: [{ tone: 'shady', text: 'Tell nobody.', end: 'leave' }, { tone: 'weird', text: 'I\'m the plug of your heart.', end: 'leave' }] },
      film: { who: 'ju', say: 'I\'m not filming, I\'m... FaceTiming my grandma. Say hi to my grandma.', pose: 'film', options: [{ tone: 'friendly', text: 'Hi Grandma.', do: (c) => { c.sell(6); c.respect(1); }, end: 'leave' }, { tone: 'aggressive', text: 'Grandma, your grandson is a liar.', do: (c) => c.sell(6), end: 'leave' }] },
      whatever: { say: 'Whatever, bro. This store dead anyway.', pose: 'angry', options: [{ tone: 'passive', text: 'Have a good night.', end: 'leave' }, { tone: 'sarcastic', text: 'Then why you here at 2 AM?', end: 'leave' }] },
      steal: {
        who: 'bam', say: '(Bam swipes a handful of candy off the rack) RUN RUN RUN!', pose: 'laugh', sfx: 'laugh',
        options: [
          { tone: 'aggressive', text: 'YO! GET BACK HERE!', do: (c) => { c.loss(9); c.note('The YNs ran out with candy'); }, end: 'steal' },
          { tone: 'passive', text: '(sigh) Kids.', do: (c) => c.loss(9), end: 'steal' },
          { tone: 'shady', text: 'Call the cops.', do: (c) => { c.loss(9); c.wild(c.npc, 1); c.police('kids stole candy'); }, end: 'steal' },
        ],
      },
    },
    onEnd: (c) => { for (const k of ['ju', 'bam']) if (c.cast[k]?.alive) c.after(c.cast[k], c.lastEnd === 'steal' ? 'steal' : 'leave'); },
  },
  {
    id: 'shoplifter', cat: 'chaos', weight: 1.2, anywhere: true, here: true, repeat: true,
    cast: { main: { kind: 'yn', name: 'Kid in the puffer', look: { outfit: 'puffer', hat: 'beanie' }, browse: 1, height: 1.66 } },
    nodes: {
      start: {
        say: '(stuffing his coat with chips and detergent pods, walking fast toward the door)', pose: 'idle', hold: 'bag',
        enter: (c) => { c.npc.speedMax = 1.6; },
        options: [
          { tone: 'aggressive', text: 'YO. Put it back.', next: () => Math.random() < 0.5 ? 'drops' : 'runs' },
          { tone: 'passive', text: 'Let it go. Not my store.', do: (c) => { c.loss(16); c.respect(-2); }, end: 'steal' },
          { tone: 'friendly', text: 'You hungry? Just ask next time.', next: 'hungry' },
          { tone: 'aggressive', text: '(pull the gun)', do: (c) => c.drawGun(), next: 'freeze' },
          { tone: 'shady', text: 'Call the cops.', do: (c) => { c.wild(c.npc, 2); c.police('shoplifter'); c.loss(16); }, next: 'runs' },
        ],
      },
      drops: { say: 'Aight, AIGHT. Damn. It\'s just chips.', pose: 'shrug', hold: null, options: [{ tone: 'passive', text: 'Then pay for them.', end: 'leave' }, { tone: 'friendly', text: 'Take the chips. Leave the pods.', do: (c) => { c.loss(2); c.respect(2); }, end: 'leave' }] },
      runs: { say: '(he bolts for the door)', pose: 'idle', options: [{ tone: 'passive', text: 'Unbelievable.', do: (c) => c.loss(16), end: 'steal' }, { tone: 'aggressive', text: 'I KNOW YOUR MOM!', do: (c) => c.loss(16), end: 'steal' }] },
      hungry: { say: '...I\'m good.', pose: 'shrug', options: [{ tone: 'friendly', text: 'Put it on my tab then.', if: (c) => c.stash >= 16, do: (c) => { c.spend(16); c.sell(16); c.respect(5); c.note('Paid for a kid\'s groceries'); }, end: 'leave' }, { tone: 'passive', text: 'Then put it back.', next: 'drops' }] },
      freeze: { say: 'BRO IT\'S CHIPS! IT\'S CHIPS!', pose: 'handsUp', hold: null, sfx: 'scream', timer: 6, timeout: 'runs', options: [{ tone: 'aggressive', text: 'Put. Them. Back.', do: (c) => c.respect(-2), next: 'drops' }, { tone: 'passive', text: '...Yeah, you right. Go.', end: 'flee' }] },
    },
  },
  {
    id: 'weed_regular', cat: 'hustle', weight: 1.3, repeat: true, cond: (x) => x.world.weed > 0,
    cast: { main: { kind: 'regular', name: 'Smoke', rid: 'smoke', look: { outfit: 'hoodie', hat: 'durag' }, voice: 0.85, browse: 1 } },
    nodes: {
      start: {
        say: (c) => c.mem.met ? 'My guy. You know what I\'m here for.' : '(leans in) You good? ...Somebody said you got that thing.', pose: 'talk', sfx: 'hmm',
        enter: (c) => c.remember({ met: (c.mem.met || 0) + 1 }),
        options: [
          { tone: 'shady', text: 'Twenty for a dub.', do: (c) => c.sellWeed(20), end: 'leave' },
          { tone: 'hustle', text: 'Thirty. Prices went up.', next: () => Math.random() < 0.6 ? 'pays30' : 'haggle' },
          { tone: 'passive', text: 'I don\'t know what you\'re talking about.', end: 'leave' },
          { tone: 'clever', text: 'Not with the cameras on.', next: 'cameras' },
        ],
      },
      pays30: { say: 'Inflation hit the plug too, huh. Aight.', options: [{ tone: 'shady', text: '(slide it under the turntable)', do: (c) => c.sellWeed(30), end: 'leave' }, { tone: 'friendly', text: 'For you? Twenty-five.', do: (c) => { c.sellWeed(25); c.remember({ mood: 2 }); }, end: 'leave' }] },
      haggle: { say: 'Thirty?? The bul on Girard got it for fifteen.', pose: 'angry', options: [{ tone: 'shady', text: 'Then go to Girard.', do: (c) => c.remember({ mood: -2 }), end: 'leave' }, { tone: 'friendly', text: 'Twenty. Final.', do: (c) => c.sellWeed(20), end: 'leave' }] },
      cameras: { say: '...You got CAMERAS? Since when?! Nah I\'m out.', pose: 'shrug', sfx: 'gasp', options: [{ tone: 'clever', text: 'Since always.', end: 'flee' }, { tone: 'friendly', text: 'Relax, they don\'t record. Twenty.', do: (c) => c.sellWeed(20), end: 'leave' }] },
    },
  },
  {
    id: 'undercover', cat: 'hustle', weight: 0.8, cond: (x) => x.world.weed > 0 && x.night >= 1,
    cast: { main: { kind: 'worker', name: 'Guy in a clean windbreaker', look: { outfit: 'work', top: 0x2a3a5a, bottom: 0x6a6a5a, hat: 'none' }, height: 1.85, browse: 1 } },
    nodes: {
      start: {
        say: 'Hey, uh, buddy. Pal. Friend. I\'m looking for some... marijuana. Weed. The reefer. For personal fun.', pose: 'talk',
        options: [
          { tone: 'shady', text: 'Forty.', next: () => Math.random() < 0.45 ? 'busted' : 'weirdo' },
          { tone: 'clever', text: 'You a cop?', next: 'cop' },
          { tone: 'dismissive', text: 'Get out.', end: 'leave' },
          { tone: 'weird', text: 'We only sell hoagies here, sir.', next: 'hoagie' },
        ],
      },
      cop: { say: 'No! ...Am I allowed to say no? I think I\'m allowed to say no.', pose: 'shrug', options: [{ tone: 'passive', text: 'Have a great night, officer.', end: 'leave' }, { tone: 'shady', text: 'Forty. Whatever.', next: () => Math.random() < 0.65 ? 'busted' : 'weirdo' }] },
      busted: {
        say: 'Philadelphia Police. Narcotics. Open that drawer.', pose: 'point', sfx: 'gasp',
        enter: (c) => { c.confiscate(); c.note('Sold to an undercover cop. Stash taken, owner fined.'); },
        options: [{ tone: 'passive', text: '...I want my lawyer.', end: 'leave' }, { tone: 'weird', text: 'It\'s oregano.', end: 'leave' }],
      },
      weirdo: { say: 'Oh wow. Okay. This is my first time. Is this how it works? Do I tip?', pose: 'laugh', options: [{ tone: 'shady', text: 'Forty and a tip.', do: (c) => { c.sellWeed(40); c.pocket(5, 'tip'); }, end: 'leave' }, { tone: 'friendly', text: 'Just go home, man.', end: 'leave' }] },
      hoagie: { say: 'Right. Right. A hoagie. Is "hoagie" code?', options: [{ tone: 'weird', text: 'Everything is code.', end: 'leave' }, { tone: 'passive', text: 'It\'s a sandwich. Eight dollars.', do: (c) => c.sell(8), end: 'leave' }] },
    },
  },
  {
    id: 'supplier', cat: 'hustle', weight: 1, cond: (x) => !x.world.flags.owesUnc,
    cast: { main: { kind: 'regular', name: 'Unc Bobby', rid: 'unc', look: { outfit: 'track', top: 0x1b2b6b }, voice: 0.8, height: 1.78, browse: 0, direct: true } },
    nodes: {
      start: {
        say: (c) => `Nephew. You looking light. Restock? You at ${c.weed} right now. That ain't a business, that\'s a hobby.`, pose: 'talk', sfx: 'hmm',
        options: [
          { tone: 'shady', text: 'Ten for $120.', if: (c) => c.stash >= 120, do: (c) => { c.spend(120); c.addWeed(10); c.note('Bought 10 from Unc Bobby'); }, next: 'pleasure' },
          { tone: 'shady', text: 'Five for $70.', if: (c) => c.stash >= 70, do: (c) => { c.spend(70); c.addWeed(5); }, next: 'pleasure' },
          { tone: 'hustle', text: 'Front me eight. I\'ll pay you $110 next time.', do: (c) => { c.addWeed(8); c.flag('owesUnc', 110); c.note('Unc Bobby fronted you 8. You owe him $110.'); }, next: 'front' },
          { tone: 'passive', text: 'I\'m good, Unc.', next: 'good' },
        ],
      },
      pleasure: { say: 'Pleasure. Keep it out the cameras, keep it out the drawer when the cops come.', options: [{ tone: 'friendly', text: 'Always, Unc.', end: 'leave' }, { tone: 'weird', text: 'What cameras?', end: 'leave' }] },
      front: { say: 'I like you. Don\'t make me not like you.', pose: 'point', options: [{ tone: 'passive', text: 'You\'ll get it.', end: 'leave' }, { tone: 'sarcastic', text: 'You like everybody, Unc.', end: 'leave' }] },
      good: { say: 'Aight. Money don\'t sleep though. Neither do you, I guess.', options: [{ tone: 'friendly', text: 'Never.', end: 'leave' }, { tone: 'passive', text: 'Night, Unc.', end: 'leave' }] },
    },
  },
  {
    id: 'unc_collect', cat: 'hustle', weight: 2, cond: (x) => !!x.world.flags.owesUnc,
    cast: { main: { kind: 'regular', name: 'Unc Bobby', rid: 'unc', look: { outfit: 'track', top: 0x1b2b6b }, voice: 0.8, height: 1.78, direct: true } },
    nodes: {
      start: {
        say: (c) => `Nephew. Collection day. That\'s $${c.world.flags.owesUnc}.`, pose: 'talk',
        options: [
          { tone: 'friendly', text: 'Here. All of it.', if: (c) => c.stash >= c.world.flags.owesUnc, do: (c) => { c.spend(c.world.flags.owesUnc); c.flag('owesUnc', 0); c.note('Paid Unc Bobby back'); }, next: 'paid' },
          { tone: 'stall', text: 'I need one more night.', next: () => Math.random() < 0.5 ? 'oneMore' : 'warn' },
          { tone: 'clever', text: 'Take it out of the register.', if: (c) => c.drawer >= c.world.flags.owesUnc, do: (c) => { c.robDrawer(c.world.flags.owesUnc / Math.max(1, c.drawer)); c.flag('owesUnc', 0); c.note('Paid Unc out of the owner\'s drawer'); }, next: 'paid' },
          { tone: 'aggressive', text: 'I ain\'t paying you nothing.', next: 'warn' },
        ],
      },
      paid: { say: 'See, that\'s why I like you.', pose: 'laugh', options: [{ tone: 'friendly', text: 'Good doing business.', end: 'leave' }, { tone: 'passive', text: '(nod)', end: 'leave' }] },
      oneMore: { say: 'One. More. Night. Plus twenty.', pose: 'point', options: [{ tone: 'passive', text: 'Bet.', do: (c) => c.flag('owesUnc', c.world.flags.owesUnc + 20), end: 'leave' }, { tone: 'sarcastic', text: 'Interest? From you?', do: (c) => c.flag('owesUnc', c.world.flags.owesUnc + 20), end: 'leave' }] },
      warn: {
        say: 'Then I\'mma send somebody who don\'t like you like I like you.', pose: 'angry',
        options: [{ tone: 'passive', text: '...', do: (c) => { c.flag('uncAngry', true); c.world.marked = Math.max(c.world.marked, 2); }, end: 'leave' }, { tone: 'aggressive', text: 'Send him then.', do: (c) => { c.flag('uncAngry', true); c.world.marked = 3; }, end: 'leave' }],
      },
    },
  },
  {
    id: 'sneakers', cat: 'hustle', weight: 0.9, cond: (x) => !x.world.fenced.length,
    cast: { main: { kind: 'yn', name: 'Sneaker Rob', look: { outfit: 'hoodie' }, hold: 'bag', direct: true, swagger: true } },
    nodes: {
      start: {
        say: 'Fresh pair, never worn, box and everything. Size 10. Retail two-fifty. For you? Sixty.', pose: 'talk',
        options: [
          { tone: 'shady', text: 'Bet. Sixty.', if: (c) => c.stash >= 60, do: (c) => { c.spend(60); c.fence('sneakers', 150); c.note('Bought hot sneakers for $60'); }, end: 'leave' },
          { tone: 'clever', text: 'Forty. They hot.', next: () => Math.random() < 0.6 ? 'forty' : 'nah' },
          { tone: 'sarcastic', text: 'Where\'d you get them?', next: 'truck' },
          { tone: 'dismissive', text: 'I don\'t do hot stuff.', end: 'leave' },
        ],
      },
      forty: { say: 'Man... aight. Forty. You robbing ME.', pose: 'shrug', options: [{ tone: 'shady', text: 'Pleasure.', if: (c) => c.stash >= 40, do: (c) => { c.spend(40); c.fence('sneakers', 150); }, end: 'leave' }, { tone: 'passive', text: 'Actually nah.', end: 'leave' }] },
      truck: { say: 'They fell off a truck. Gently. Onto my hands.', pose: 'laugh', sfx: 'laugh', options: [{ tone: 'shady', text: 'Sixty.', if: (c) => c.stash >= 60, do: (c) => { c.spend(60); c.fence('sneakers', 150); }, end: 'leave' }, { tone: 'dismissive', text: 'Walk them off a truck somewhere else.', end: 'leave' }] },
      nah: { say: 'Forty?? I\'ll wear them myself then.', options: [{ tone: 'passive', text: 'Enjoy.', end: 'leave' }, { tone: 'shady', text: 'Fine, sixty.', if: (c) => c.stash >= 60, do: (c) => { c.spend(60); c.fence('sneakers', 150); }, end: 'leave' }] },
    },
  },
  {
    id: 'sneaker_buyer', cat: 'hustle', weight: 2, cond: (x) => x.world.fenced.length > 0,
    cast: { main: { kind: 'regular', name: 'Marcus', look: { outfit: 'track' }, browse: 1 } },
    nodes: {
      start: {
        say: (c) => `Somebody said you got ${c.world.fenced[0].item}? Size 10?`, pose: 'talk',
        options: [
          { tone: 'shady', text: 'One fifty.', next: () => Math.random() < 0.55 ? 'buys150' : 'haggle' },
          { tone: 'shady', text: 'Hundred. Quick sale.', do: (c) => c.sellFenced(100), end: 'leave' },
          { tone: 'passive', text: 'Don\'t know who told you that.', end: 'leave' },
        ],
      },
      buys150: { say: 'Bet. My son gon go crazy.', options: [{ tone: 'friendly', text: '(hand over the box)', do: (c) => c.sellFenced(150), end: 'leave' }, { tone: 'weird', text: 'Tell him a truck sent them.', do: (c) => c.sellFenced(150), end: 'leave' }] },
      haggle: { say: 'One twenty, final.', options: [{ tone: 'shady', text: 'Deal.', do: (c) => c.sellFenced(120), end: 'leave' }, { tone: 'dismissive', text: 'One fifty or nothing.', end: 'leave' }] },
    },
  },
  {
    id: 'numbers', cat: 'hustle', weight: 0.9,
    cast: { main: { kind: 'church', name: 'Miss Gloria', rid: 'gloria', look: { outfit: 'church', female: true, hat: 'none' }, voice: 1.1, browse: 1 } },
    nodes: {
      start: {
        say: 'Put me in for 4-1-7 straight, ten dollars. Don\'t tell my pastor.', pose: 'talk',
        options: [
          { tone: 'shady', text: 'You\'re in, Miss Gloria.', do: (c) => { c.pocket(10); c.bet('Miss Gloria', 10); c.note('Took a $10 number from Miss Gloria'); }, end: 'leave' },
          { tone: 'passive', text: 'I don\'t run numbers no more.', next: 'no' },
          { tone: 'weird', text: '417? That\'s my address.', next: 'address' },
        ],
      },
      no: { say: 'Since when? Your uncle ran numbers out this store for 20 years.', pose: 'point', options: [{ tone: 'shady', text: 'Fine. You\'re in.', do: (c) => { c.pocket(10); c.bet('Miss Gloria', 10); }, end: 'leave' }, { tone: 'passive', text: 'New management.', end: 'leave' }] },
      address: { say: 'Then it\'s a sign. Make it twenty.', pose: 'laugh', sfx: 'laugh', options: [{ tone: 'shady', text: 'Twenty it is.', do: (c) => { c.pocket(20); c.bet('Miss Gloria', 20); }, end: 'leave' }, { tone: 'friendly', text: 'Ten is plenty, Miss Gloria.', do: (c) => { c.pocket(10); c.bet('Miss Gloria', 10); }, end: 'leave' }] },
    },
  },
  {
    id: 'crisis', cat: 'chaos', weight: 0.8, anywhere: true,
    cast: { main: { kind: 'unhoused', name: 'Screaming Steve', look: { outfit: 'ragged' }, wild: 1, voice: 0.95, direct: true, jitter: 1 } },
    nodes: {
      start: {
        say: 'THE CHIPS ARE LOOKING AT ME. WHY ARE THE CHIPS LOOKING AT ME. WHO PUT EYES ON THE CHIPS.', pose: 'angry', sfx: 'scream',
        options: [
          { tone: 'friendly', text: 'Steve. Steve. Breathe. Nobody\'s looking at you.', next: () => Math.random() < 0.6 ? 'calm' : 'worse' },
          { tone: 'shady', text: 'Call the cops.', do: (c) => { c.wild(c.npc, 3); c.police('a man screaming in the store'); }, next: 'worse' },
          { tone: 'weird', text: 'They\'re looking at me too, Steve. Let\'s leave them alone.', next: 'calm' },
          { tone: 'aggressive', text: 'GET OUT!', next: 'worse' },
        ],
      },
      calm: { say: '...okay. Okay. They stopped. You got a water? I\'m thirsty. I\'m so thirsty.', pose: 'shrug', sfx: 'sigh', options: [{ tone: 'friendly', text: 'Here. On me.', if: (c) => c.stash >= 2, do: (c) => { c.spend(2); c.respect(3); c.wild(c.npc, -1); c.note('Talked Steve down'); }, end: 'leave' }, { tone: 'passive', text: 'Go get some air, Steve.', do: (c) => c.wild(c.npc, -1), end: 'leave' }] },
      worse: {
        say: '(knocks a row of cans off the shelf) YOU\'RE ALL IN ON IT!', pose: 'angry', sfx: 'scream', enter: (c) => c.knock(c.npc),
        options: [{ tone: 'passive', text: '(wait for it to pass)', end: 'loiter' }, { tone: 'shady', text: 'Call the cops.', do: (c) => { c.wild(c.npc, 3); c.police('a man trashing the store'); }, end: 'loiter' }],
      },
    },
  },
  {
    id: 'drunk_ray', cat: 'chaos', weight: 0.8,
    cast: { main: { kind: 'drunk', name: 'Big Ray', drunk: true, look: { outfit: 'tee', top: 0xf4f4f0 }, height: 1.9, build: 1.3, voice: 0.75, direct: true } },
    nodes: {
      start: {
        say: 'Gimme a six. Gimme TWO sixes. It\'s my birthday. It ain\'t my birthday. Gimme the beer.', pose: 'talk', sfx: 'laugh',
        options: [
          { tone: 'passive', text: 'Twenty-two dollars.', do: (c) => c.sell(22), next: 'happy' },
          { tone: 'friendly', text: 'Ray, you drove here?', next: 'drove' },
          { tone: 'dismissive', text: 'You\'re cut off, Ray.', next: () => Math.random() < 0.5 ? 'throws' : 'sad' },
          { tone: 'hustle', text: 'Birthday beer is thirty.', do: (c) => c.sell(22, { gouge: 8 }), next: 'happy' },
        ],
      },
      happy: { say: 'I LOVE THIS STORE! I love the cat! Where\'s the cat?!', pose: 'dance', sfx: 'laugh', options: [{ tone: 'friendly', text: 'Cat\'s sleeping. Go home, Ray.', end: 'leave' }, { tone: 'weird', text: 'The cat moved to Delaware.', end: 'leave' }] },
      drove: { say: '...I rode a bike. A Indego bike. It\'s in the street.', pose: 'shrug', options: [{ tone: 'friendly', text: 'Walk it home.', do: (c) => { c.sell(11); c.respect(1); }, end: 'leave' }, { tone: 'sarcastic', text: 'That\'s still driving, Ray.', do: (c) => c.sell(11), end: 'leave' }] },
      sad: { say: 'Cut off... by a corner store. That\'s a new low. That\'s a new low, man.', sfx: 'sigh', options: [{ tone: 'friendly', text: 'Get a water, Ray.', do: (c) => c.sell(1), end: 'leave' }, { tone: 'passive', text: 'Night, Ray.', end: 'leave' }] },
      throws: {
        say: '(hurls a bottle at the plexi) YOU AIN\'T MY DAD!', pose: 'angry', sfx: 'scream', enter: (c) => { c.throwBottle(c.npc); },
        options: [{ tone: 'shady', text: 'Call the cops.', do: (c) => { c.wild(c.npc, 2); c.police('a drunk throwing bottles'); }, end: 'loiter' }, { tone: 'passive', text: 'Get out, Ray.', end: 'leave' }, { tone: 'aggressive', text: '(pull the gun)', do: (c) => c.drawGun(), next: 'gunRay' }],
      },
      gunRay: { say: 'Whoa. WHOA. Aight. I\'m leaving. I\'m sober now. I\'m so sober.', pose: 'handsUp', options: [{ tone: 'aggressive', text: 'Go.', end: 'flee' }, { tone: 'passive', text: '(put it away) Just go home.', do: (c) => c.holster(), end: 'leave' }] },
    },
  },
  // ------------------------------------------------------------------ danger
  {
    id: 'robbery_nervous', cat: 'danger', weight: 1.2, anywhere: true, repeat: true,
    cast: { main: { kind: 'robber', name: 'Ski Mask', look: { outfit: 'robber' }, direct: true, jitter: 1.5, voice: 1.1, speed: 1.4, wild: 4 } },
    nodes: {
      start: {
        say: (c) => `YO. YO. Drawer. Put it on the spinny thing. NOW. ${c.inBooth ? '' : 'Get BEHIND the counter!'}`, pose: 'aim', hold: 'gun', sfx: 'scream', timer: 9, timeout: 'shoots', tag: 'ROBBERY',
        enter: (c) => { c.panic(c.npc); c.duck(); },
        options: [
          { tone: 'passive', text: 'Aight, aight. Take it.', do: (c) => { c.robDrawer(1); c.turntable(); }, next: 'took' },
          { tone: 'stall', text: 'The drawer\'s on a timer, man. Give me a sec.', next: 'stall' },
          { tone: 'clever', text: 'This glass is bulletproof. You came all this way for ninety dollars?', if: (c) => c.inBooth, next: () => Math.random() < 0.5 ? 'talked' : 'angrier' },
          { tone: 'aggressive', text: '(pull your gun)', do: (c) => c.drawGun(), next: 'standoff' },
          { tone: 'weird', text: '...Is that a water gun? That\'s a water gun.', next: 'insulted' },
        ],
      },
      took: {
        say: 'Pockets too!— nah forget it. DON\'T LOOK AT ME!', pose: 'aim', sfx: 'scream',
        options: [
          { tone: 'passive', text: 'Let him go.', end: 'flee' },
          { tone: 'shady', text: 'Call the cops the second he\'s out.', do: (c) => c.police('armed robbery'), end: 'flee' },
          { tone: 'aggressive', text: '(draw on him as he runs)', do: (c) => c.drawGun(), end: 'flee' },
        ],
      },
      stall: {
        say: 'I AIN\'T GOT A SEC!', pose: 'aim', timer: 6, timeout: 'shoots',
        options: [
          { tone: 'passive', text: 'Here, here, take it.', do: (c) => { c.robDrawer(1); c.turntable(); }, next: 'took' },
          { tone: 'clever', text: '(hit the panic button under the counter)', if: (c) => c.inBooth, do: (c) => c.police('panic button: robbery'), next: () => Math.random() < 0.6 ? 'fleesPanic' : 'shoots' },
          { tone: 'aggressive', text: '(pull your gun)', do: (c) => c.drawGun(), next: 'standoff' },
        ],
      },
      fleesPanic: { say: 'WHAT YOU JUST PRESS?! Nah I\'m out, I\'m OUT!', pose: 'aim', sfx: 'scream', options: [{ tone: 'aggressive', text: 'RUN then!', do: (c) => c.respect(4), end: 'flee' }, { tone: 'sarcastic', text: 'Have a good night!', do: (c) => c.respect(4), end: 'flee' }] },
      standoff: {
        say: 'Whoa whoa WHOA — you strapped?! In a CORNER STORE?!', pose: 'aim', timer: 6, timeout: 'shoots', tag: 'STANDOFF',
        options: [
          { tone: 'aggressive', text: 'Drop it and walk out.', next: () => Math.random() < 0.6 ? 'backsOff' : 'shoots' },
          { tone: 'clever', text: 'We can both walk away from this.', next: () => Math.random() < 0.8 ? 'backsOff' : 'shoots' },
          { tone: 'passive', text: 'Take the drawer, just go.', do: (c) => { c.robDrawer(1); c.turntable(); }, next: 'took' },
          { tone: 'aggressive', text: '(shoot first)', end: 'hostile' },
        ],
      },
      backsOff: { say: 'Aight... aight. This ain\'t over.', pose: 'aim', options: [{ tone: 'aggressive', text: 'Get out.', do: (c) => { c.respect(6); c.note('Ran off an armed robber'); }, end: 'flee' }, { tone: 'shady', text: 'Calling the cops on you anyway.', do: (c) => { c.respect(4); c.police('armed robbery attempt'); }, end: 'flee' }] },
      insulted: { say: 'IT\'S NOT A WATER GUN.', pose: 'aim', timer: 5, timeout: 'shoots', options: [{ tone: 'aggressive', text: 'Prove it.', next: 'shoots' }, { tone: 'passive', text: 'My bad, my bad. Here.', do: (c) => { c.robDrawer(1); c.turntable(); }, next: 'took' }, { tone: 'weird', text: 'It\'s giving water gun.', next: () => Math.random() < 0.5 ? 'shoots' : 'embarrassed' }] },
      embarrassed: { say: '...It was a water gun. I\'m so embarrassed. My cousin said this would work.', pose: 'shrug', hold: null, enter: (c) => { c.npc.wild = 1; }, options: [{ tone: 'friendly', text: 'Go home, man.', do: (c) => { c.respect(5); c.note('Talked down a robber with a water gun'); }, end: 'leave' }, { tone: 'shady', text: 'Call the cops.', do: (c) => c.police('attempted robbery'), end: 'flee' }] },
      talked: { say: '...for real? Ninety? Man, this ain\'t even my gun. It\'s my cousin\'s.', pose: 'shrug', options: [{ tone: 'friendly', text: 'Go home, man.', do: (c) => { c.respect(5); c.note('Talked a robber out of it'); }, end: 'leave' }, { tone: 'clever', text: 'Leave the gun on the turntable and I won\'t call nobody.', do: (c) => { c.npc.body.hold(null); c.turntable(); c.ammo(15); c.note('Took a robber\'s gun off him'); c.respect(8); }, end: 'leave' }, { tone: 'shady', text: '(call the cops while he thinks)', do: (c) => c.police('armed robbery'), end: 'flee' }] },
      angrier: { say: 'You think I\'m PLAYING?!', pose: 'aim', timer: 4, timeout: 'shoots', options: [{ tone: 'passive', text: 'Take it! Take it!', do: (c) => { c.robDrawer(1); c.turntable(); }, next: 'took' }, { tone: 'aggressive', text: 'I think you\'re playing.', next: 'shoots' }] },
      shoots: { say: 'AAAAH!', enter: (c) => c.end('hostile'), options: [] },
    },
  },
  {
    id: 'robbery_pro', cat: 'danger', weight: 0.9, anywhere: true, minNight: 1, repeat: true,
    cast: {
      main: { kind: 'robber', name: 'Calm Man', look: { outfit: 'robber' }, direct: true, voice: 0.75, wild: 4, height: 1.86 },
      lookout: { kind: 'robber', name: 'Lookout', look: { outfit: 'robber', top: 0x2a2a2a }, direct: true, wild: 4, voice: 0.9, idlePose: 'gunSide', hold: 'gun' },
    },
    onStart: (c) => { const l = c.cast.lookout; if (l) { l.state = 'talking'; l.goTo({ x: 2.6, z: 4.8 }); } },
    nodes: {
      start: {
        say: 'Evening. Nobody needs to be a hero. Drawer on the turntable. Then your pockets.', pose: 'aim', hold: 'gun', timer: 10, timeout: 'warn', tag: 'ROBBERY',
        enter: (c) => { c.panic(c.npc); },
        options: [
          { tone: 'passive', text: 'Okay. Okay. Everything.', do: (c) => { c.robDrawer(1); c.robPockets(); c.turntable(); }, next: 'done' },
          { tone: 'clever', text: 'Take the drawer. My pockets got nothing but lint.', do: (c) => { c.robDrawer(1); c.turntable(); }, next: () => Math.random() < 0.6 ? 'done' : 'liar' },
          { tone: 'clever', text: '(hit the panic button)', if: (c) => c.inBooth, do: (c) => c.police('panic button: armed robbery'), next: () => Math.random() < 0.5 ? 'done' : 'shootout' },
          { tone: 'aggressive', text: '(pull your gun)', do: (c) => c.drawGun(), next: 'standoff' },
          { tone: 'weird', text: 'Do y\'all have a podcast?', next: 'warn' },
        ],
      },
      warn: { say: 'I\'m going to count to three. One.', pose: 'aim', timer: 4, timeout: 'shootout', options: [{ tone: 'passive', text: 'Here! Everything!', do: (c) => { c.robDrawer(1); c.robPockets(); c.turntable(); }, next: 'done' }, { tone: 'aggressive', text: '(pull your gun)', do: (c) => c.drawGun(), next: 'standoff' }] },
      liar: { say: 'Pockets. I won\'t ask again.', pose: 'aim', timer: 5, timeout: 'shootout', options: [{ tone: 'passive', text: '(empty your pockets onto the turntable)', do: (c) => { c.robPockets(); c.turntable(); }, next: 'done' }, { tone: 'aggressive', text: 'No.', next: 'shootout' }] },
      done: { say: 'Appreciate your cooperation. Have a blessed night.', pose: 'aim', options: [{ tone: 'passive', text: '...', end: 'flee' }, { tone: 'shady', text: '(call the cops as soon as they\'re out)', do: (c) => c.police('armed robbery'), end: 'flee' }] },
      standoff: { who: 'lookout', say: 'HE GOT A GUN! HE GOT A GUN!', pose: 'aim', timer: 4, timeout: 'shootout', tag: 'STANDOFF', options: [{ tone: 'aggressive', text: 'Both of you. OUT.', next: () => Math.random() < 0.45 ? 'leave' : 'shootout' }, { tone: 'passive', text: '(lower it) Take the drawer.', do: (c) => { c.holster(); c.robDrawer(1); c.turntable(); }, next: 'done' }, { tone: 'aggressive', text: '(open fire)', end: 'hostile' }] },
      leave: { say: 'Not worth it. Let\'s go.', pose: 'aim', options: [{ tone: 'aggressive', text: '(keep your aim)', do: (c) => { c.respect(10); c.note('Faced down two armed robbers'); }, end: 'flee' }, { tone: 'shady', text: '(call the cops)', do: (c) => { c.respect(8); c.police('armed robbery attempt'); }, end: 'flee' }] },
      shootout: { say: 'Wrong choice.', enter: (c) => c.end('hostile'), options: [] },
    },
    onEnd: (c) => { const l = c.cast.lookout; if (l?.alive) c.after(l, c.lastEnd === 'hostile' ? 'hostile' : 'flee'); },
  },
  {
    id: 'knife', cat: 'danger', weight: 1, anywhere: true, repeat: true,
    cast: { main: { kind: 'unhoused', name: 'Big Rich', look: { outfit: 'ragged', hat: 'beanie' }, direct: true, jitter: 1, wild: 3, voice: 0.85, hold: 'knife', height: 1.84 } },
    nodes: {
      start: {
        say: (c) => c.inBooth ? 'OPEN THE DOOR. I KNOW YOU GOT MY MONEY IN THERE.' : 'Don\'t move. Don\'t MOVE. Where my money at?', pose: 'knifeOut', sfx: 'scream', tag: 'KNIFE', timer: 10, timeout: 'attack',
        enter: (c) => { c.panic(c.npc); c.audio('knife-out'); },
        options: [
          { tone: 'friendly', text: 'Ain\'t nobody got your money, Rich.', next: () => Math.random() < 0.5 ? 'calmer' : 'attack' },
          { tone: 'passive', text: 'Here, twenty dollars. Just go.', if: (c) => c.stash >= 20, do: (c) => { c.spend(20); c.turntable(); }, next: 'takes' },
          { tone: 'weird', text: '(unlock the booth door)', if: (c) => c.inBooth && !c.boothOpen, do: (c) => c.openBooth(), next: 'attack' },
          { tone: 'shady', text: 'I\'m calling the cops right now.', do: (c) => c.police('a man with a knife'), next: 'attack' },
          { tone: 'aggressive', text: '(pull your gun)', do: (c) => c.drawGun(), next: 'gunVsKnife' },
        ],
      },
      calmer: { say: '...they took my cart. Everything I had was in my cart.', pose: 'hurt', hold: null, sfx: 'sigh', enter: (c) => { c.npc.wild = 1; }, options: [{ tone: 'friendly', text: 'Want a coffee? On me.', if: (c) => c.stash >= 2, do: (c) => { c.spend(2); c.respect(4); c.note('Calmed Big Rich down'); }, end: 'leave' }, { tone: 'passive', text: 'Sorry, man. You gotta go though.', end: 'leave' }] },
      takes: { say: '...Twenty. Aight. Aight.', pose: 'idle', options: [{ tone: 'passive', text: 'Go on.', end: 'leave' }, { tone: 'friendly', text: 'Get something to eat.', end: 'leave' }] },
      gunVsKnife: { say: 'You gon shoot me? Over a store that ain\'t even yours?', pose: 'knifeOut', timer: 6, timeout: 'attack', options: [{ tone: 'aggressive', text: 'Drop it, Rich.', next: () => Math.random() < 0.7 ? 'drops' : 'attack' }, { tone: 'aggressive', text: 'Yeah. I will.', next: () => Math.random() < 0.5 ? 'drops' : 'attack' }, { tone: 'friendly', text: '...No. Go home, Rich.', next: 'drops' }] },
      drops: { say: '(drops the knife) Whatever. Whatever, man.', pose: 'shrug', hold: null, enter: (c) => { c.npc.wild = 1; }, options: [{ tone: 'passive', text: 'Out.', end: 'leave' }, { tone: 'shady', text: 'Calling the cops anyway.', do: (c) => c.police('a man with a knife'), end: 'loiter' }] },
      attack: { say: 'AAAAAH!', enter: (c) => c.end('hostile'), options: [] },
    },
    onEnd: (c) => { if (c.lastEnd === 'hostile') c.hostile(c.npc, 'knife'); },
  },
  {
    id: 'beef', cat: 'danger', weight: 0.9, anywhere: true, minNight: 1,
    cast: {
      main: { kind: 'yn', name: 'Dre', look: { outfit: 'puffer' }, direct: true, swagger: true, wild: 1 },
      tone: { kind: 'yn', name: 'Lil Tone', look: { outfit: 'hoodie', hat: 'durag' }, direct: true, swagger: true, wild: 3, idlePose: 'gunSide', hold: 'gun' },
    },
    nodes: {
      start: {
        say: 'Lemme get a— nah. NAH. Not him. Not right now.', pose: 'point', sfx: 'gasp',
        options: [
          { tone: 'friendly', text: 'Not in here, y\'all. Take it outside.', next: () => Math.random() < 0.5 ? 'outside' : 'shots' },
          { tone: 'passive', text: '(duck behind the counter)', do: (c) => c.duck(true), next: 'shots' },
          { tone: 'shady', text: 'I\'m calling the cops.', do: (c) => c.police('two men about to shoot it out'), next: () => Math.random() < 0.6 ? 'outside' : 'shots' },
          { tone: 'weird', text: 'Wait. Who owes who? I\'m invested now.', next: 'explain' },
          { tone: 'aggressive', text: '(pull your gun) NOBODY move.', do: (c) => c.drawGun(), next: () => Math.random() < 0.7 ? 'outside' : 'shots' },
        ],
      },
      explain: { who: 'tone', say: 'He owe me forty dollars since JULY.', pose: 'point', options: [{ tone: 'friendly', text: 'Here\'s forty. Peace. Both of you.', if: (c) => c.stash >= 40, do: (c) => { c.spend(40); c.respect(8); c.note('Paid off a $40 beef to stop a shootout'); }, next: 'peace' }, { tone: 'clever', text: 'Dre. It\'s forty dollars. Pay the man.', next: () => Math.random() < 0.6 ? 'peace' : 'shots' }, { tone: 'aggressive', text: 'Fight! Fight! Fight!', next: 'fistfight' }] },
      peace: { who: 'main', say: '...Aight. We good. We good, Tone.', pose: 'shrug', options: [{ tone: 'friendly', text: 'Now buy something.', do: (c) => { c.sell(6); for (const k of ['main', 'tone']) c.after(c.cast[k], 'leave'); }, end: 'leave' }, { tone: 'weird', text: 'Hug it out.', do: (c) => { c.after(c.cast.tone, 'leave'); }, end: 'leave' }] },
      fistfight: { say: 'Bet!', pose: 'angry', enter: (c) => { c.cast.tone.body.hold(null); c.fight(c.npc, c.cast.tone); }, options: [{ tone: 'passive', text: '(watch)', end: 'stay' }, { tone: 'shady', text: '(call the cops)', do: (c) => c.police('a fight in the store'), end: 'stay' }] },
      outside: { who: 'tone', say: 'Outside then. You can\'t hide in here forever, Dre.', pose: 'point', options: [{ tone: 'passive', text: '(let them walk out)', do: (c) => { c.after(c.cast.tone, 'leave'); c.later(9, () => { c.audio('gunshot-distant'); c.note('Shots on the corner after Dre and Tone left'); }); }, end: 'leave' }, { tone: 'friendly', text: 'Y\'all go different directions.', do: (c) => { c.after(c.cast.tone, 'leave'); c.respect(2); }, end: 'leave' }] },
      shots: { who: 'tone', say: 'Nah. Right here, right now.', pose: 'aim', enter: (c) => { c.shootout(c.cast.tone, c.npc); c.end('stay'); }, options: [] },
    },
  },
];

// ------------------------------------------------------------------ idle barks and NPC-to-NPC chatter
export const IDLE_BARKS = {
  regular: ['They raised the price on these AGAIN?', 'Yo, where the Butterkrunch at?', 'Why it\'s always cold in here?', 'I been up since yesterday.', 'Mmm. Nah.', 'This the last hot chips?', 'Bro, the cat is judging me.'],
  yn: ['Bro hold my phone.', 'You seen that video? Nah you ain\'t seen it.', 'I\'m not even hungry for real.', 'Ayo where the wraps at?', 'Bet. Bet. Bet.'],
  tourist: ['Is this a bodega? Do they call it a bodega here?', 'Brad, don\'t touch anything.', 'This is so authentic.'],
  nurse: ['I\'m so tired.', 'Never again. Never again.', 'Where is the coffee.'],
  worker: ['Long shift.', 'My back.', 'Overtime, baby.'],
  drunk: ['I love you guys. All of you.', 'Which way is the door. There\'s two doors.', 'HEYYYY.'],
  kid: ['Can I get two of these?', 'My mom said I can get one thing.'],
  driver: ['Four minutes. Four minutes.', 'The app is lying to me.'],
  church: ['Lord, these prices.', 'Mm-hm. Mm-hm.'],
  unhoused: ['It\'s cold out there.', 'Bless.', 'Y\'all got hot water?'],
  streamer: ['Chat, look at this cat.', 'Y\'all, the lighting in here is crazy.', 'Comment "corner store" if you wanna see more.'],
  robber: [], cop: ['Mm.', 'Evening.'],
};
export const CHATTER = [
  { lines: [['a', 'You seen the Birds last week?'], ['b', 'Don\'t even talk to me about it.'], ['a', 'That\'s what I thought.']] },
  { lines: [['a', 'Yo, you used to go to Overbrook?'], ['b', 'Nah, that was my cousin.'], ['a', 'Y\'all look EXACTLY alike.'], ['b', 'Everybody say that.']] },
  { lines: [['a', 'Excuse me, can you reach that for me?'], ['b', 'The top one? I got you.']] },
  { lines: [['a', 'Bro, you bumped me.'], ['b', 'I ain\'t bump nobody.'], ['a', 'You did. You did bump me.'], ['b', 'And what?']], fight: 0.35 },
  { lines: [['a', 'Is that your car with the music outside?'], ['b', 'What about it?'], ['a', 'Nothing. It go hard.']] },
  { lines: [['a', 'They got water ice?'], ['b', 'In NOVEMBER?'], ['a', 'Water ice is a year-round food.']] },
  { a: ['tourist'], lines: [['a', 'Sorry, is it "wooder" or "water"?'], ['b', 'It\'s wooder.'], ['a', 'Wooder. Wow.']] },
  { b: ['tourist'], lines: [['a', 'Y\'all lost?'], ['b', 'Is it that obvious?'], ['a', 'You got a fanny pack on.']] },
  { lines: [['a', 'You still owe me twenty.'], ['b', 'I paid you!'], ['a', 'With what? Vibes?']], fight: 0.25 },
  { lines: [['a', 'This store got the best hoagies.'], ['b', 'The grill closed though.'], ['a', 'It\'s always closed when I come.']] },
];
