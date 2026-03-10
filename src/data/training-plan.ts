import { TrainingWeek } from '@/lib/types';

export const trainingPlan: TrainingWeek[] = [
  {
    weekNumber: 1,
    label: 'Week 1 — Opbouw',
    days: [
      {
        day: 'Maandag',
        dayIndex: 0,
        isRestDay: false,
        sessions: [
          {
            sport: 'zwemmen',
            type: 'techniek',
            durationMinutes: 45,
            zone: 'Z3',
            description: 'Zwemmen techniek + uithoudingsvermogen',
          },
          {
            sport: 'fietsen',
            type: 'herstel',
            durationMinutes: 45,
            zone: 'Z2',
            description: 'Fietsen herstelrit, licht tempo',
          },
        ],
      },
      {
        day: 'Dinsdag',
        dayIndex: 1,
        isRestDay: false,
        sessions: [
          {
            sport: 'hardlopen',
            type: 'interval',
            durationMinutes: 50,
            zone: 'Z4',
            description: 'Hardlopen intervallen: 6x 800m met 2 min rust',
          },
        ],
      },
      {
        day: 'Woensdag',
        dayIndex: 2,
        isRestDay: true,
        sessions: [
          {
            sport: 'rust',
            type: 'rust',
            description: 'Rustdag — actief herstel of volledig rust',
          },
        ],
      },
      {
        day: 'Donderdag',
        dayIndex: 3,
        isRestDay: false,
        sessions: [
          {
            sport: 'hardlopen',
            type: 'duur',
            durationMinutes: 60,
            zone: 'Z3',
            description: 'Duurloop in Z3, stabiel tempo',
          },
        ],
      },
      {
        day: 'Vrijdag',
        dayIndex: 4,
        isRestDay: false,
        sessions: [
          {
            sport: 'zwemmen',
            type: 'tempo',
            durationMinutes: 45,
            zone: 'Z4',
            description: 'Zwemmen tempo/techniek, wisselslag drills',
          },
        ],
      },
      {
        day: 'Zaterdag',
        dayIndex: 5,
        isRestDay: false,
        sessions: [
          {
            sport: 'hardlopen',
            type: 'rustig',
            durationMinutes: 45,
            zone: 'Z2',
            description: 'Rustige duurloop, laag tempo',
          },
        ],
      },
      {
        day: 'Zondag',
        dayIndex: 6,
        isRestDay: false,
        sessions: [
          {
            sport: 'fietsen',
            type: 'lang',
            durationMinutes: 105,
            zone: 'Z3',
            description: 'Lange fietsrit 90-120 min in Z3',
          },
          {
            sport: 'hardlopen',
            type: 'brick',
            durationMinutes: 25,
            zone: 'Z3',
            description: 'Brick run: direct na fietsen, 20-30 min in Z3',
          },
        ],
      },
    ],
  },
  {
    weekNumber: 2,
    label: 'Week 2 — Variatie',
    days: [
      {
        day: 'Maandag',
        dayIndex: 0,
        isRestDay: false,
        sessions: [
          {
            sport: 'zwemmen',
            type: 'techniek',
            durationMinutes: 45,
            zone: 'Z3',
            description: 'Zwemmen techniek + drills',
          },
          {
            sport: 'fietsen',
            type: 'herstel',
            durationMinutes: 45,
            zone: 'Z2',
            description: 'Fietsen herstelrit, licht tempo',
          },
        ],
      },
      {
        day: 'Dinsdag',
        dayIndex: 1,
        isRestDay: false,
        sessions: [
          {
            sport: 'hardlopen',
            type: 'tempo',
            durationMinutes: 50,
            zone: 'Z4',
            description: 'Temporun: 20 min opwarmen, 20 min Z4, 10 min cooldown',
          },
        ],
      },
      {
        day: 'Woensdag',
        dayIndex: 2,
        isRestDay: true,
        sessions: [
          {
            sport: 'rust',
            type: 'rust',
            description: 'Rustdag — actief herstel of volledig rust',
          },
        ],
      },
      {
        day: 'Donderdag',
        dayIndex: 3,
        isRestDay: false,
        sessions: [
          {
            sport: 'hardlopen',
            type: 'duur',
            durationMinutes: 65,
            zone: 'Z3',
            description: 'Duurloop in Z3, langer dan week 1',
          },
        ],
      },
      {
        day: 'Vrijdag',
        dayIndex: 4,
        isRestDay: false,
        sessions: [
          {
            sport: 'zwemmen',
            type: 'duur',
            durationMinutes: 50,
            zone: 'Z3',
            description: 'Duurzwemmen: langere afstanden, constant tempo',
          },
        ],
      },
      {
        day: 'Zaterdag',
        dayIndex: 5,
        isRestDay: false,
        sessions: [
          {
            sport: 'mountainbike',
            type: 'vrij',
            durationMinutes: 60,
            zone: 'Z3',
            description: 'Mountainbike ca. 1 uur, vrij tempo',
          },
        ],
      },
      {
        day: 'Zondag',
        dayIndex: 6,
        isRestDay: false,
        sessions: [
          {
            sport: 'zwemmen',
            type: 'techniek',
            durationMinutes: 40,
            zone: 'Z3',
            description: 'Zwemmen techniek en uithoudingsvermogen',
          },
          {
            sport: 'hardlopen',
            type: 'duur',
            durationMinutes: 50,
            zone: 'Z3',
            description: 'Duurloop aansluitend na zwemmen',
          },
        ],
      },
    ],
  },
];
