/* Default routine, checklist, workout plan and quotes. Everything here is editable in the app. */
(function () {
  let n = 0;
  const B = (start, end, title, kind, stat, xp, extra) =>
    Object.assign({ id: 'b' + (++n), start, end, title, kind, stat, xp }, extra || {});

  const morning = () => [
    B('05:30', '05:35', 'Wake up and drink water', 'wake', 'dsc', 20),
    B('05:35', '06:15', 'Home workout', 'workout', 'str', 60),
    B('06:15', '06:35', 'Brush and bath', 'hygiene', 'vit', 20),
    B('06:35', '08:05', 'GS study: new topic', 'study', 'int', 120, { focus: 'gs' }),
    B('08:05', '08:45', 'Answer writing: 2 answers', 'answer', 'int', 80),
  ];

  const weekday = [
    ...morning(),
    B('08:45', '09:15', 'Tea and get ready', 'routine', 'dsc', 10),
    B('09:15', '09:30', 'Leave for office by 9:15', 'routine', 'dsc', 15),
    B('09:30', '19:30', 'Office', 'office', 'dsc', 0),
    B('11:30', '11:50', 'Breakfast', 'meal', 'hlt', 15),
    B('13:30', '14:00', 'Lunch', 'meal', 'hlt', 15),
    B('19:30', '20:15', 'Travel, freshen up, short rest', 'routine', 'vit', 10),
    B('20:15', '20:45', 'Dinner', 'meal', 'hlt', 15),
    B('20:45', '22:45', 'Anthropology optional', 'study', 'int', 150, { focus: 'opt' }),
    B('22:45', '23:15', 'Revise today and plan tomorrow', 'plan', 'dsc', 40),
    B('23:15', '23:30', 'Wind down, no screen', 'routine', 'vit', 15),
    B('23:30', '23:35', 'Lights out', 'sleep', 'vit', 30),
  ];

  const sat = [
    ...morning(),
    B('08:45', '09:15', 'Tea and get ready', 'routine', 'dsc', 10),
    B('09:15', '09:30', 'Leave for office by 9:15', 'routine', 'dsc', 15),
    B('09:30', '15:00', 'Office', 'office', 'dsc', 0),
    B('11:30', '11:50', 'Breakfast', 'meal', 'hlt', 15),
    B('13:30', '14:00', 'Lunch', 'meal', 'hlt', 15),
    B('15:00', '15:45', 'Travel, freshen up, short rest', 'routine', 'vit', 10),
    B('15:45', '17:45', 'CSAT practice', 'csat', 'int', 120),
    B('17:45', '18:15', 'Tea and break', 'routine', 'vit', 5),
    B('18:15', '20:15', 'Current affairs: weekly compilation', 'ca', 'int', 110),
    B('20:15', '20:45', 'Dinner', 'meal', 'hlt', 15),
    B('20:45', '22:45', 'Anthropology optional', 'study', 'int', 150, { focus: 'opt' }),
    B('22:45', '23:15', 'Revise today and plan tomorrow', 'plan', 'dsc', 40),
    B('23:15', '23:30', 'Wind down, no screen', 'routine', 'vit', 15),
    B('23:30', '23:35', 'Lights out', 'sleep', 'vit', 30),
  ];

  const sun = [
    B('05:30', '05:35', 'Wake up and drink water', 'wake', 'dsc', 20),
    B('05:35', '06:15', 'Home workout', 'workout', 'str', 60),
    B('06:15', '06:35', 'Brush and bath', 'hygiene', 'vit', 20),
    B('06:35', '08:05', 'Weekly GS revision', 'revision', 'int', 110),
    B('08:05', '08:45', 'Answer writing: 2 answers', 'answer', 'int', 80),
    B('08:45', '09:30', 'Tea, breakfast, get ready', 'meal', 'hlt', 15),
    B('09:30', '11:30', 'Prelims mock test (exam timing)', 'mock', 'int', 150),
    B('11:30', '13:00', 'Mock analysis: note every mistake', 'mock', 'int', 90),
    B('13:00', '14:30', 'Lunch and rest', 'meal', 'hlt', 15),
    B('14:30', '16:30', 'CSAT practice', 'csat', 'int', 120),
    B('16:30', '17:00', 'Break', 'routine', 'vit', 5),
    B('17:00', '18:30', 'Essay practice: 1 essay', 'essay', 'int', 120),
    B('18:30', '20:15', 'Catch-up block (or Anthropology revision)', 'buffer', 'int', 100),
    B('20:15', '20:45', 'Dinner', 'meal', 'hlt', 15),
    B('20:45', '22:45', 'Anthropology: new topic', 'study', 'int', 150, { focus: 'opt' }),
    B('22:45', '23:15', 'Weekly review and plan next week', 'plan', 'dsc', 50),
    B('23:15', '23:30', 'Wind down, no screen', 'routine', 'vit', 15),
    B('23:30', '23:35', 'Lights out', 'sleep', 'vit', 30),
  ];

  const checklist = [
    { id: 'c1', title: 'Brush before bed', stat: 'vit', xp: 10 },
    { id: 'c2', title: 'Wash face', stat: 'vit', xp: 5 },
    { id: 'c3', title: 'Clean clothes', stat: 'vit', xp: 5 },
    { id: 'c4', title: 'Drink 3 litres of water', stat: 'hlt', xp: 15 },
    { id: 'c5', title: 'No junk food today', stat: 'hlt', xp: 15 },
    { id: 'c6', title: 'Read the newspaper', stat: 'int', xp: 20 },
  ];

  const E = (name, sets) => ({ name, sets });
  const warm = E('Skipping warm-up', '5 min');
  const push = { name: 'Push', list: [warm, E('Dumbbell bench press', '4 × 10'), E('Incline dumbbell press', '3 × 10'), E('Seated shoulder press', '3 × 10'), E('Lateral raises', '3 × 15'), E('Overhead triceps extension', '3 × 12'), E('Push-ups', '2 × max')] };
  const pull = { name: 'Pull', list: [warm, E('One-arm dumbbell row', '4 × 10 each'), E('Chest-supported row on incline bench', '3 × 12'), E('Rear-delt fly', '3 × 15'), E('Biceps curls', '3 × 12'), E('Hammer curls', '3 × 12'), E('Ab roller', '3 × 8')] };
  const legs = { name: 'Legs and core', list: [warm, E('Goblet squat', '4 × 12'), E('Dumbbell Romanian deadlift', '3 × 10'), E('Reverse lunges', '3 × 10 each'), E('Bulgarian split squat on bench', '3 × 8 each'), E('Calf raises', '3 × 20'), E('Ab roller', '3 × 10')] };
  const cardio = { name: 'Skipping and core', list: [E('Skipping intervals: 1 min on, 30 s off', '10 rounds'), E('Plank', '3 × 45 s'), E('Ab roller', '3 × 10'), E('Leg raises on bench', '3 × 12'), E('Full-body stretching', '10 min')] };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  // index = JS day number (0 Sunday … 6 Saturday)
  const workout = [clone(cardio), clone(push), clone(pull), clone(legs), clone(push), clone(pull), clone(legs)];

  const quotes = [
    ['Arise, awake, and stop not till the goal is reached.', 'Swami Vivekananda'],
    ['Take up one idea. Make that one idea your life. Think of it, dream of it, live on that idea.', 'Swami Vivekananda'],
    ['You have a right to your actions, but never to the fruits of your actions.', 'Bhagavad Gita 2.47'],
    ['Dream is not that which you see while sleeping, it is something that does not let you sleep.', 'A. P. J. Abdul Kalam'],
    ['If you want to shine like a sun, first burn like a sun.', 'A. P. J. Abdul Kalam'],
    ['Excellence is a continuous process and not an accident.', 'A. P. J. Abdul Kalam'],
    ['Strength does not come from physical capacity. It comes from an indomitable will.', 'Mahatma Gandhi'],
    ['Cultivation of mind should be the ultimate aim of human existence.', 'B. R. Ambedkar'],
    ['Education is the most powerful weapon which you can use to change the world.', 'Nelson Mandela'],
    ['We are what we repeatedly do. Excellence, then, is not an act, but a habit.', 'Will Durant'],
    ['It does not matter how slowly you go as long as you do not stop.', 'Confucius'],
    ['The man who moves a mountain begins by carrying away small stones.', 'Confucius'],
    ['Success is the sum of small efforts, repeated day in and day out.', 'Robert Collier'],
    ['Hard work beats talent when talent doesn’t work hard.', 'Tim Notke'],
    ['Well done is better than well said.', 'Benjamin Franklin'],
    ['Energy and persistence conquer all things.', 'Benjamin Franklin'],
    ['Amateurs sit and wait for inspiration, the rest of us just get up and go to work.', 'Stephen King'],
    ['He who has a why to live can bear almost any how.', 'Friedrich Nietzsche'],
    ['Waste no more time arguing what a good man should be. Be one.', 'Marcus Aurelius'],
    ['You have power over your mind, not outside events. Realize this, and you will find strength.', 'Marcus Aurelius'],
    ['First say to yourself what you would be; and then do what you have to do.', 'Epictetus'],
    ['No man is free who is not master of himself.', 'Epictetus'],
    ['It is not that we have a short time to live, but that we waste a lot of it.', 'Seneca'],
    ['Luck is what happens when preparation meets opportunity.', 'Seneca'],
    ['The best way out is always through.', 'Robert Frost'],
    ['Fall seven times, stand up eight.', 'Japanese proverb'],
    ['A journey of a thousand miles begins with a single step.', 'Lao Tzu'],
    ['Perseverance is not a long race; it is many short races one after the other.', 'Walter Elliot'],
    ['Don’t watch the clock; do what it does. Keep going.', 'Sam Levenson'],
    ['Without hard work, nothing grows but weeds.', 'Gordon B. Hinckley'],
    ['Little by little, one travels far.', 'Spanish proverb'],
    ['Champions keep playing until they get it right.', 'Billie Jean King'],
    ['Focus on being productive instead of busy.', 'Tim Ferriss'],
    ['Study while others are sleeping; work while others are loafing; prepare while others are playing.', 'William Arthur Ward'],
    ['Courage doesn’t always roar. Sometimes it is the quiet voice at the end of the day saying, “I will try again tomorrow.”', 'Mary Anne Radmacher'],
    ['Live as if you were to die tomorrow. Learn as if you were to live forever.', 'Mahatma Gandhi'],
    ['What you do today can improve all your tomorrows.', 'Ralph Marston'],
    ['Small daily improvements over time lead to stunning results.', 'Robin Sharma'],
    ['You do not rise to the level of your goals. You fall to the level of your systems.', 'James Clear'],
    ['Every action you take is a vote for the type of person you wish to become.', 'James Clear'],
    ['I am not afraid of storms, for I am learning how to sail my ship.', 'Louisa May Alcott'],
    ['Do the hard jobs first. The easy jobs will take care of themselves.', 'Dale Carnegie'],
    ['The expert in anything was once a beginner.', 'Helen Hayes'],
    ['Opportunities don’t happen. You create them.', 'Chris Grosser'],
    ['The pain of discipline weighs ounces. The pain of regret weighs tons.', 'Jim Rohn'],
    ['Discipline is the bridge between goals and accomplishment.', 'Jim Rohn'],
    ['Motivation is what gets you started. Habit is what keeps you going.', 'Jim Ryun'],
    ['The secret of your future is hidden in your daily routine.', 'Mike Murdock'],
  ].map(([q, a], i) => ({ id: 'q' + (i + 1), q, a }));

  window.DEFAULTS = {
    schedule: { weekday, sat, sun },
    checklist,
    workout,
    quotes,
    settings: {
      name: 'Player',
      examDate: '2027-05-23',
      examTime: '09:30',
      applyDate: '2027-02-10',
      syllabusTarget: '2027-01-31',
      bossHours: 30,
      officeStart: '09:30',
      officeEnd: '19:30',
      clearAt: 70,
      sound: true,
      haptics: true,
      morning: true,
      track: { steps: true, sleep: true, screen: true, goal: 8000 },
      notif: {
        on: true, lead: 5, plan: '22:00', review: '20:30', money: '21:30',
        kinds: { wake: true, workout: true, hygiene: false, study: true, meal: true, office: true, night: true, money: false },
        custom: [],
      },
    },
  };
})();
