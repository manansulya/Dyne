import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { COURSE_COLORS } from "@/lib/constants";
import { addDays, addHours, addMinutes } from "date-fns";
import { randomUUID } from "node:crypto";
import { devFixturesEnabled, devFixturesDisabledResponse } from "@/lib/dev-fixtures";

const DAYS = [1, 2, 3, 4, 5]; // Mon-Fri

interface CourseSeed {
  name: string;
  code: string;
  professor: string;
  color: string;
  icon: string;
  schedule: Array<{ day: number; startTime: string; endTime: string; location: string }>;
  assignments: Array<{
    title: string;
    dueInDays: number;
    description: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    progress: number;
    tasks: Array<{ title: string; done: boolean; dueInDays: number }>;
  }>;
  exams: Array<{
    title: string;
    inDays: number;
    topics: string;
    importance: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  }>;
  notes: Array<{ title: string; content: string }>;
}

const SEED: CourseSeed[] = [
  {
    name: "Calculus II",
    code: "MATH 152",
    professor: "Dr. Sarah Chen",
    color: "#0ea5e9",
    icon: "Calculator",
    schedule: [
      { day: 1, startTime: "09:00", endTime: "10:00", location: "Hall A-201" },
      { day: 3, startTime: "09:00", endTime: "10:00", location: "Hall A-201" },
      { day: 5, startTime: "09:00", endTime: "10:00", location: "Hall A-201" },
    ],
    assignments: [
      {
        title: "Integration Problem Set 4",
        dueInDays: 2,
        description: "Problems 1–10 on integration techniques: substitution, parts, partial fractions.",
        priority: "HIGH",
        progress: 60,
        tasks: [
          { title: "Read chapter 7", done: true, dueInDays: 0 },
          { title: "Problems 1–5", done: true, dueInDays: 0 },
          { title: "Problems 6–8", done: false, dueInDays: 1 },
          { title: "Problems 9–10", done: false, dueInDays: 2 },
          { title: "Submit on portal", done: false, dueInDays: 2 },
        ],
      },
      {
        title: "Series Convergence Worksheet",
        dueInDays: 9,
        description: "Ratio test, root test, integral test, comparison tests.",
        priority: "MEDIUM",
        progress: 0,
        tasks: [
          { title: "Review ratio test", done: false, dueInDays: 6 },
          { title: "Review integral test", done: false, dueInDays: 7 },
          { title: "Complete worksheet", done: false, dueInDays: 9 },
        ],
      },
    ],
    exams: [
      {
        title: "Midterm Exam",
        inDays: 14,
        topics: "Integration techniques, applications of integration, series convergence",
        importance: "HIGH",
      },
    ],
    notes: [
      {
        title: "Integration by Parts",
        content:
          "∫u dv = uv - ∫v du\n\nChoose u using LIATE: Logarithm, Inverse trig, Algebraic, Trig, Exponential.\n\nExamples:\n• ∫x·e^x dx → u=x, dv=e^x dx → xe^x - e^x + C\n• ∫ln(x) dx → u=ln(x), dv=dx → x·ln(x) - x + C",
      },
    ],
  },
  {
    name: "Data Structures",
    code: "CS 201",
    professor: "Prof. Marcus Rivera",
    color: "#10b981",
    icon: "Code2",
    schedule: [
      { day: 2, startTime: "11:00", endTime: "12:30", location: "Lab B-105" },
      { day: 4, startTime: "11:00", endTime: "12:30", location: "Lab B-105" },
    ],
    assignments: [
      {
        title: "AVL Tree Implementation",
        dueInDays: 5,
        description: "Implement AVL tree with insert, delete, search, and rebalancing. Submit code + report.",
        priority: "HIGH",
        progress: 30,
        tasks: [
          { title: "Design node structure", done: true, dueInDays: 0 },
          { title: "Implement insert", done: true, dueInDays: 0 },
          { title: "Implement rotations", done: false, dueInDays: 2 },
          { title: "Implement delete", done: false, dueInDays: 4 },
          { title: "Write tests", done: false, dueInDays: 4 },
          { title: "Submit on GitHub", done: false, dueInDays: 5 },
        ],
      },
      {
        title: "Hash Table Lab Report",
        dueInDays: 1,
        description: "Compare open addressing vs. chaining under different load factors.",
        priority: "URGENT",
        progress: 80,
        tasks: [
          { title: "Run benchmarks", done: true, dueInDays: 0 },
          { title: "Plot results", done: true, dueInDays: 0 },
          { title: "Write discussion", done: false, dueInDays: 1 },
          { title: "Proofread", done: false, dueInDays: 1 },
        ],
      },
    ],
    exams: [
      {
        title: "Midterm Exam",
        inDays: 21,
        topics: "Trees, BSTs, AVL trees, hashing, heaps",
        importance: "HIGH",
      },
    ],
    notes: [
      {
        title: "BST vs AVL vs Red-Black",
        content:
          "BST: O(n) worst case, O(log n) average.\nAVL: balanced, O(log n) worst case, stricter balance than red-black.\nRed-black: balanced, O(log n) worst case, fewer rotations on insert/delete.",
      },
    ],
  },
  {
    name: "Modern Physics",
    code: "PHYS 220",
    professor: "Dr. Emily Watson",
    color: "#8b5cf6",
    icon: "Atom",
    schedule: [
      { day: 1, startTime: "14:00", endTime: "15:30", location: "Physics Hall 1" },
      { day: 3, startTime: "14:00", endTime: "15:30", location: "Physics Hall 1" },
    ],
    assignments: [
      {
        title: "Lab Report: Photoelectric Effect",
        dueInDays: 3,
        description: "Analyze data, plot stopping potential vs. frequency, determine Planck's constant.",
        priority: "HIGH",
        progress: 40,
        tasks: [
          { title: "Analyze data", done: true, dueInDays: 0 },
          { title: "Create graph", done: true, dueInDays: 0 },
          { title: "Write discussion", done: false, dueInDays: 2 },
          { title: "Proofread", done: false, dueInDays: 3 },
          { title: "Submit", done: false, dueInDays: 3 },
        ],
      },
      {
        title: "Quantum Mechanics Problem Set",
        dueInDays: 7,
        description: "Schrödinger equation, wavefunctions, expectation values.",
        priority: "MEDIUM",
        progress: 0,
        tasks: [
          { title: "Read chapter 4", done: false, dueInDays: 4 },
          { title: "Solve problems 1–5", done: false, dueInDays: 6 },
          { title: "Solve problems 6–8", done: false, dueInDays: 7 },
        ],
      },
    ],
    exams: [
      {
        title: "Final Exam",
        inDays: 35,
        topics: "Special relativity, quantum mechanics, atomic physics",
        importance: "URGENT",
      },
    ],
    notes: [
      {
        title: "Photoelectric Effect",
        content:
          "E = hν - φ\n\nWhere h = 6.626×10⁻³⁴ J·s (Planck's constant).\nφ = work function of material.\nStopping potential V₀ = KE_max / e.",
      },
    ],
  },
  {
    name: "Cognitive Psychology",
    code: "PSY 230",
    professor: "Dr. Alicia Mendez",
    color: "#f59e0b",
    icon: "Brain",
    schedule: [
      { day: 2, startTime: "15:00", endTime: "16:30", location: "Social Sci 220" },
      { day: 4, startTime: "15:00", endTime: "16:30", location: "Social Sci 220" },
    ],
    assignments: [
      {
        title: "Reading Reflection: Memory Models",
        dueInDays: 4,
        description: "Write 500-word reflection on Atkinson-Shiffrin vs. working memory model.",
        priority: "LOW",
        progress: 0,
        tasks: [
          { title: "Read chapter 5", done: false, dueInDays: 2 },
          { title: "Outline reflection", done: false, dueInDays: 3 },
          { title: "Write reflection", done: false, dueInDays: 4 },
        ],
      },
    ],
    exams: [
      {
        title: "Quiz: Memory Systems",
        inDays: 5,
        topics: "Short-term, long-term, working memory",
        importance: "MEDIUM",
      },
    ],
    notes: [],
  },
  {
    name: "Spanish II",
    code: "SPAN 102",
    professor: "Prof. Lucas Romero",
    color: "#ec4899",
    icon: "Languages",
    schedule: [
      { day: 1, startTime: "10:30", endTime: "11:45", location: "Lang Center 110" },
      { day: 3, startTime: "10:30", endTime: "11:45", location: "Lang Center 110" },
      { day: 5, startTime: "10:30", endTime: "11:45", location: "Lang Center 110" },
    ],
    assignments: [
      {
        title: "Oral Presentation: Mi Ciudad",
        dueInDays: 6,
        description: "5-minute oral presentation about your city in Spanish.",
        priority: "MEDIUM",
        progress: 20,
        tasks: [
          { title: "Write draft", done: true, dueInDays: 0 },
          { title: "Practice pronunciation", done: false, dueInDays: 5 },
          { title: "Practice with peer", done: false, dueInDays: 6 },
        ],
      },
    ],
    exams: [],
    notes: [],
  },
  {
    name: "Linear Algebra",
    code: "MATH 220",
    professor: "Dr. James Park",
    color: "#14b8a6",
    icon: "FunctionSquare",
    schedule: [
      { day: 2, startTime: "13:00", endTime: "14:30", location: "Math Bldg 304" },
      { day: 4, startTime: "13:00", endTime: "14:30", location: "Math Bldg 304" },
    ],
    assignments: [
      {
        title: "Eigenvalues Worksheet",
        dueInDays: 10,
        description: "Compute eigenvalues/eigenvectors, diagonalize matrices.",
        priority: "MEDIUM",
        progress: 0,
        tasks: [
          { title: "Review characteristic polynomial", done: false, dueInDays: 7 },
          { title: "Complete problems 1–8", done: false, dueInDays: 10 },
        ],
      },
    ],
    exams: [
      {
        title: "Midterm Exam",
        inDays: 18,
        topics: "Vector spaces, linear transformations, eigenvalues",
        importance: "HIGH",
      },
    ],
    notes: [],
  },
];

const HABITS_SEED = [
  { name: "Daily reading", color: "#10b981", targetPerWeek: 7 },
  { name: "Exercise", color: "#0ea5e9", targetPerWeek: 4 },
  { name: "Sleep before midnight", color: "#8b5cf6", targetPerWeek: 7 },
  { name: "Revision", color: "#f59e0b", targetPerWeek: 5 },
];

const GOALS_SEED = [
  { title: "Study 20 hours this week", target: 20, unit: "hours", type: "STUDY_HOURS" },
  { title: "Complete all assignments 2 days early", target: 5, unit: "assignments", type: "TASKS_COMPLETED" },
  { title: "Maintain 90% attendance", target: 90, unit: "%", type: "CUSTOM" },
];

export const POST = withUserId(async (userId) => {
  if (!devFixturesEnabled()) return devFixturesDisabledResponse();

  // Fixtures are strictly additive: nothing here deletes or replaces existing
  // rows, so running it can never destroy real data.
  // Create semester
  const now = new Date();
  const semester = await db.semester.create({
    data: {
      userId,
      name: "Fall Semester",
      startDate: now,
      endDate: addDays(now, 120),
    },
  });

  const courseMap: Record<string, string> = {};
  for (let i = 0; i < SEED.length; i++) {
    const c = SEED[i];
    const course = await db.course.create({
      data: {
        userId,
        semesterId: semester.id,
        name: c.name,
        code: c.code,
        professor: c.professor,
        color: c.color,
        icon: c.icon,
      },
    });
    courseMap[c.code] = course.id;

    // Schedule events
    for (const sch of c.schedule) {
      const today = new Date();
      today.setDate(today.getDate() - today.getDay() + 1 + sch.day);
      const [sh, sm] = sch.startTime.split(":").map((x) => parseInt(x, 10));
      const [eh, em] = sch.endTime.split(":").map((x) => parseInt(x, 10));
      const start = new Date(today);
      start.setHours(sh, sm, 0, 0);
      const end = new Date(today);
      end.setHours(eh, em, 0, 0);
      await db.event.create({
        data: {
          userId,
          courseId: course.id,
          title: `${c.code}`,
          type: "CLASS",
          startDate: start,
          endDate: end,
          recurrence: "WEEKLY",
          location: sch.location,
        },
      });
    }

    // Assignments
    for (const a of c.assignments) {
      const dueDate = addDays(now, a.dueInDays);
      const assignment = await db.assignment.create({
        data: {
          userId,
          courseId: course.id,
          title: a.title,
          description: a.description,
          dueDate,
          dueTime: "23:59",
          status: a.progress === 100 ? "COMPLETED" : a.progress > 0 ? "IN_PROGRESS" : "TODO",
          priority: a.priority,
          progress: a.progress,
        },
      });
      for (const t of a.tasks) {
        await db.task.create({
          data: {
            userId,
            courseId: course.id,
            assignmentId: assignment.id,
            title: t.title,
            status: t.done ? "COMPLETED" : "TODO",
            priority: a.priority,
            dueDate: t.dueInDays === 0 ? null : addDays(now, t.dueInDays),
          },
        });
      }
    }

    // Exams
    for (const e of c.exams) {
      await db.exam.create({
        data: {
          userId,
          courseId: course.id,
          title: e.title,
          date: addDays(now, e.inDays),
          time: "09:00",
          location: "Exam Hall TBD",
          topics: e.topics,
          importance: e.importance,
          preparationProgress: e.importance === "URGENT" ? 30 : 50,
        },
      });
    }

    // Notes
    for (const n of c.notes) {
      await db.note.create({
        data: {
          userId,
          courseId: course.id,
          title: n.title,
          content: n.content,
        },
      });
    }
  }

  // Habits
  for (const h of HABITS_SEED) {
    const habit = await db.habit.create({
      data: {
        userId,
        name: h.name,
        color: h.color,
        targetPerWeek: h.targetPerWeek,
        frequency: "DAILY",
      },
    });
    // Create some habit logs in the past week
    for (let d = 0; d < 7; d++) {
      // Random ~70% completion
      if (Math.random() < 0.7) {
        const date = new Date();
        date.setDate(date.getDate() - d);
        date.setHours(0, 0, 0, 0);
        await db.habitLog.create({
          data: {
            habitId: habit.id,
            userId,
            date,
            completed: true,
          },
        });
      }
    }
  }

  // Goals
  for (const g of GOALS_SEED) {
    await db.goal.create({
      data: {
        userId,
        title: g.title,
        target: g.target,
        unit: g.unit,
        type: g.type as "STUDY_HOURS" | "TASKS_COMPLETED" | "ATTENDANCE" | "CUSTOM",
        current: g.type === "STUDY_HOURS" ? 12 : g.type === "TASKS_COMPLETED" ? 2 : 0,
        deadline: addDays(now, 7),
        status: "ACTIVE",
      },
    });
  }

  // A few study sessions in the past week
  for (let d = 0; d < 7; d++) {
    const sessionCount = Math.floor(Math.random() * 3);
    for (let s = 0; s < sessionCount; s++) {
      const start = addHours(addDays(now, -d), -Math.floor(Math.random() * 8));
      const duration = 25 + Math.floor(Math.random() * 90);
      const codes = Object.keys(courseMap);
      const code = codes[Math.floor(Math.random() * codes.length)];
      await db.studySession.create({
        data: {
          userId,
          courseId: courseMap[code],
          startTime: start,
          endTime: addMinutes(start, duration),
          duration,
          focusStatus: Math.random() < 0.8 ? "FOCUSED" : "DISTRACTED",
        },
      });
    }
  }

  // Personal events
  await db.event.create({
    data: {
      userId,
      title: "Gym session",
      type: "PERSONAL",
      startDate: addHours(addDays(now, 1), 2),
      endDate: addHours(addDays(now, 1), 3),
      recurrence: "WEEKLY",
      location: "Gym",
    },
  });

  // Notifications
  await db.notification.createMany({
    data: [
      {
        userId,
        title: "Assignment due tomorrow",
        message: "Hash Table Lab Report is due tomorrow at 23:59.",
        type: "ASSIGNMENT_DUE",
        actionUrl: "?view=assignments",
      },
      {
        userId,
        title: "Exam in 2 weeks",
        message: "Calculus II Midterm Exam is in 14 days.",
        type: "EXAM_REMINDER",
        actionUrl: "?view=exams",
      },
    ],
  });

  // ----------------------------------------
  // Social: communities + posts + comments
  // ----------------------------------------
  const COMMUNITY_SEED = [
    {
      name: "cs_students",
      description: "Computer Science students — share resources, ask questions, find study buddies.",
      color: "#10b981",
      posts: [
        {
          title: "Best resources for learning dynamic programming?",
          content: "I'm taking Algorithms next semester and want to get a head start. Any recommendations for tutorials, problem sets, or books? I've heard good things about the CSES problem set.",
          comments: [
            { content: "CSES is excellent. Also check out the 'Dynamic Programming' chapter in CLRS — it's dense but comprehensive." },
            { content: "Errichto's YouTube series on DP is fantastic for visual learners." },
          ],
        },
        {
          title: "Anyone else struggling with system design interviews?",
          content: "I can solve LeetCode mediums consistently but system design feels like a completely different skill. How did you all practice?",
          comments: [
            { content: "Buy 'Designing Data-Intensive Applications' — it's the bible. Also practice with a friend by mock-interviewing each other." },
          ],
        },
      ],
    },
    {
      name: "campus_life",
      description: "Everything campus: events, clubs, recommendations, advice.",
      color: "#f59e0b",
      posts: [
        {
          title: "Best study spots on campus that aren't the library?",
          content: "The library is always packed during midterms. Where do you all go when you need quiet + good coffee + WiFi?",
          comments: [
            { content: "The third floor of the Physics building has nice quiet alcoves. Almost nobody goes there." },
            { content: "Local café on Elm St — they have a back room with big tables and don't mind you staying all day." },
            { content: "Empty classrooms in the morning (before 9 AM) are great if you don't mind the chairs." },
          ],
        },
      ],
    },
    {
      name: "math_help",
      description: "Help with math courses — Calculus, Linear Algebra, Discrete Math, etc.",
      color: "#0ea5e9",
      posts: [
        {
          title: "Why does the integral of 1/x equal ln|x| + C?",
          content: "I get that d/dx ln(x) = 1/x, but how do you derive the integral directly? Is there an intuitive explanation?",
          comments: [
            { content: "Think of it geometrically: 1/x is the derivative of the area under the curve from 1 to x. So the antiderivative IS the natural log." },
          ],
        },
      ],
    },
  ];

  const suffix = randomUUID().slice(0, 4);
  const communityMap: Record<string, string> = {};
  for (const cs of COMMUNITY_SEED) {
    // Community names are globally unique; suffix them so fixtures can be run
    // more than once and by more than one local account.
    const community = await db.community.create({
      data: {
        name: `${cs.name}_${suffix}`,
        description: cs.description,
        color: cs.color,
        createdBy: userId,
        members: { create: { userId, role: "ADMIN" } },
      },
    });
    communityMap[cs.name] = community.id;

    // Create posts
    for (const p of cs.posts) {
      const post = await db.post.create({
        data: {
          communityId: community.id,
          authorId: userId,
          title: p.title,
          content: p.content,
        },
      });
      // Create comments on the post
      for (const c of p.comments) {
        await db.comment.create({
          data: {
            postId: post.id,
            authorId: userId,
            content: c.content,
          },
        });
      }
      // Add a few upvotes (synthetic)
      // Note: since there's only one user, we can't actually have multi-user votes.
      // Instead, leave them at 0 — honest empty state.
    }
  }

  // ----------------------------------------
  // Communication: spaces + channels + messages
  // ----------------------------------------
  const SPACE_SEED = [
    {
      name: "CS 201 Study Group",
      description: "Study group for Data Structures — coordinate homework, share notes, prep for exams.",
      color: "#10b981",
      channelMessages: [
        { channel: "general", messages: [
          "Hey everyone, anyone want to form a study group for the AVL tree assignment?",
          "I'm in! What time works?",
          "How about Wednesday 7 PM at the library?",
          "Sounds good. I'll book a room.",
        ]},
        { channel: "announcements", messages: [
          "Office hours moved to Thursday 3 PM this week.",
        ]},
        { channel: "study-group", messages: [
          "For the AVL assignment, focus on understanding rotations first before coding.",
          "I found this great visualization: https://www.usfca.edu/~galles/visualization/AVLtree",
          "Pro tip: write test cases BEFORE you implement. Saved me hours of debugging.",
        ]},
      ],
    },
    {
      name: "First Year Friends",
      description: "First-year students connecting, sharing tips, finding friends.",
      color: "#ec4899",
      channelMessages: [
        { channel: "general", messages: [
          "Anyone going to the welcome dinner tonight?",
          "Yeah! Meet at the dorm lobby at 6?",
        ]},
      ],
    },
  ];

  for (const sp of SPACE_SEED) {
    const space = await db.space.create({
      data: {
        name: sp.name,
        description: sp.description,
        color: sp.color,
        ownerId: userId,
        members: { create: { userId, role: "ADMIN" } },
        channels: {
          create: [
            { name: "general", type: "TEXT", createdById: userId, position: 0 },
            { name: "announcements", type: "TEXT", createdById: userId, position: 1 },
            { name: "study-group", type: "TEXT", createdById: userId, position: 2 },
            { name: "off-topic", type: "TEXT", createdById: userId, position: 3 },
          ],
        },
      },
      include: { channels: true },
    });
    // Seed messages into channels
    for (const cm of sp.channelMessages) {
      const ch = space.channels.find((c) => c.name === cm.channel);
      if (!ch) continue;
      // Add 10-minute spacing between messages, going back in time
      let offset = cm.messages.length * 10 * 60 * 1000;
      for (const msg of cm.messages) {
        await db.message.create({
          data: {
            channelId: ch.id,
            authorId: userId,
            content: msg,
            createdAt: new Date(Date.now() - offset),
          },
        });
        offset -= 10 * 60 * 1000;
      }
    }
  }

  return NextResponse.json({ ok: true, courses: SEED.length });
});
