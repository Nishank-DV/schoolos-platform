import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. School
  const school = await prisma.school.upsert({
    where: { code: "DEMO-SCHOOL-001" },
    update: {},
    create: {
      name: "Demo International School",
      code: "DEMO-SCHOOL-001",
      address: "123 Education Avenue, Demo City",
      phone: "+1 555-0100",
      email: "admin@demoschool.edu",
      timezone: "Asia/Kolkata",
    },
  });
  console.log("School created:", school.name);

  // 2. Parent
  const parent = await prisma.parent.upsert({
    where: { id: "seed-parent-1" },
    update: {},
    create: {
      id: "seed-parent-1",
      schoolId: school.id,
      firstName: "Raj",
      lastName: "Kumar",
      email: "raj.kumar@example.com",
      phone: "+1 555-0101",
    },
  });
  console.log("Parent created:", parent.firstName, parent.lastName);

  // 3. Teacher
  const teacher = await prisma.teacher.upsert({
    where: { id: "seed-teacher-1" },
    update: {},
    create: {
      id: "seed-teacher-1",
      schoolId: school.id,
      firstName: "Priya",
      lastName: "Sharma",
      email: "priya.sharma@demoschool.edu",
      phone: "+1 555-0102",
      subjectIds: [],
    },
  });
  console.log("Teacher created:", teacher.firstName, teacher.lastName);

  // 4. Class
  const classEntity = await prisma.class.upsert({
    where: { id: "seed-class-1" },
    update: {},
    create: {
      id: "seed-class-1",
      schoolId: school.id,
      name: "9-A",
      grade: 9,
      section: "A",
      teacherId: teacher.id,
    },
  });
  console.log("Class created:", classEntity.name);

  // 5. Section
  const section = await prisma.section.upsert({
    where: { id: "seed-section-1" },
    update: {},
    create: {
      id: "seed-section-1",
      schoolId: school.id,
      classId: classEntity.id,
      name: "A",
      capacity: 40,
    },
  });
  console.log("Section created:", section.name);

  // 6. Academic year
  const academicYear = await prisma.academicYear.upsert({
    where: { id: "seed-year-1" },
    update: {},
    create: {
      id: "seed-year-1",
      schoolId: school.id,
      name: "2025-26",
      startDate: new Date("2025-06-01"),
      endDate: new Date("2026-03-31"),
      isActive: true,
    },
  });
  console.log("Academic year created:", academicYear.name);

  // 7. Subjects
  const mathSubject = await prisma.subject.upsert({
    where: { id: "seed-subject-math" },
    update: {},
    create: {
      id: "seed-subject-math",
      schoolId: school.id,
      classId: classEntity.id,
      name: "Mathematics",
      code: "MATH",
    },
  });
  const scienceSubject = await prisma.subject.upsert({
    where: { id: "seed-subject-science" },
    update: {},
    create: {
      id: "seed-subject-science",
      schoolId: school.id,
      classId: classEntity.id,
      name: "Science",
      code: "SCI",
    },
  });
  console.log("Subjects created: Math, Science");

  await prisma.teacher.update({
    where: { id: teacher.id },
    data: { subjectIds: [mathSubject.id, scienceSubject.id] },
  });

  // 8. Students (3: 2 grade 9, 1 grade 10)
  const passwordHash = await bcrypt.hash("Student@123", 10);
  const students = await Promise.all([
    prisma.student.upsert({
      where: { admissionNumber: "STU-2024-001" },
      update: {},
      create: {
        admissionNumber: "STU-2024-001",
        schoolId: school.id,
        firstName: "Arjun",
        lastName: "Kumar",
        grade: 9,
        section: "A",
        parentId: parent.id,
        classId: classEntity.id,
        status: "active",
      },
    }),
    prisma.student.upsert({
      where: { admissionNumber: "STU-2024-002" },
      update: {},
      create: {
        admissionNumber: "STU-2024-002",
        schoolId: school.id,
        firstName: "Sneha",
        lastName: "Reddy",
        grade: 9,
        section: "A",
        parentId: parent.id,
        classId: classEntity.id,
        status: "active",
      },
    }),
    prisma.student.upsert({
      where: { admissionNumber: "STU-2024-003" },
      update: {},
      create: {
        admissionNumber: "STU-2024-003",
        schoolId: school.id,
        firstName: "Vikram",
        lastName: "Singh",
        grade: 10,
        section: "B",
        parentId: parent.id,
        classId: null,
        status: "active",
      },
    }),
  ]);
  console.log("Students created:", students.length);

  // 9. Users for login
  const adminHash = await bcrypt.hash("Admin@123", 10);
  const teacherHash = await bcrypt.hash("Teacher@123", 10);
  const parentHash = await bcrypt.hash("Parent@123", 10);

  await prisma.user.upsert({
    where: { email: "admin@schoolos.demo" },
    update: {},
    create: {
      email: "admin@schoolos.demo",
      passwordHash: adminHash,
      role: Role.school_admin,
      schoolId: school.id,
    },
  });
  await prisma.user.upsert({
    where: { email: "priya.sharma@demoschool.edu" },
    update: {},
    create: {
      email: "priya.sharma@demoschool.edu",
      passwordHash: teacherHash,
      role: Role.teacher,
      schoolId: school.id,
      teacherId: teacher.id,
    },
  });
  await prisma.user.upsert({
    where: { email: "raj.kumar@example.com" },
    update: {},
    create: {
      email: "raj.kumar@example.com",
      passwordHash: parentHash,
      role: Role.parent,
      schoolId: school.id,
      parentId: parent.id,
    },
  });

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    await prisma.user.upsert({
      where: { email: `student${i + 1}@schoolos.demo` },
      update: {},
      create: {
        email: `student${i + 1}@schoolos.demo`,
        passwordHash,
        role: Role.student,
        schoolId: school.id,
        studentId: s.id,
      },
    });
  }
  console.log("Users created for admin, teacher, parent, 3 students");

  // 10. Career profiles for students (with consent for first two)
  for (let i = 0; i < students.length; i++) {
    await prisma.careerProfile.upsert({
      where: { studentId: students[i].id },
      update: {},
      create: {
        studentId: students[i].id,
        favoriteSubjects: i === 0 ? ["Mathematics", "Science"] : i === 1 ? ["Science", "English"] : ["Mathematics"],
        hobbies: ["Reading", "Coding", "Sports"],
        likedActivities: ["Problem solving", "Experiments"],
        dislikedActivities: ["Rote learning"],
        parentalConsent: i < 2,
      },
    });
  }
  console.log("Career profiles created");

  // 11. Sample attendance
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const s of students) {
    await prisma.attendance.upsert({
      where: {
        studentId_date: { studentId: s.id, date: today },
      },
      update: {},
      create: {
        studentId: s.id,
        date: today,
        status: "present",
      },
    });
  }
  console.log("Sample attendance created");

  // 12. Sample assignment + attachment + submission
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  const assignment = await prisma.assignment.upsert({
    where: { id: "seed-assignment-1" },
    update: {},
    create: {
      id: "seed-assignment-1",
      schoolId: school.id,
      classId: classEntity.id,
      sectionId: section.id,
      subjectId: mathSubject.id,
      teacherId: teacher.id,
      academicYearId: academicYear.id,
      title: "Algebra - Linear Equations",
      description: "Solve problems 1-20 from Chapter 4",
      dueDate,
      maxMarks: 20,
    },
  });
  await prisma.assignmentAttachment.upsert({
    where: { id: "seed-assignment-attachment-1" },
    update: {},
    create: {
      id: "seed-assignment-attachment-1",
      assignmentId: assignment.id,
      fileUrl: "https://example.com/algebra-sheet.pdf",
      fileName: "Algebra Worksheet.pdf",
    },
  });
  await prisma.assignmentSubmission.upsert({
    where: {
      assignmentId_studentId: {
        assignmentId: assignment.id,
        studentId: students[0].id,
      },
    },
    update: {
      fileUrl: "https://example.com/student1-algebra-solutions.pdf",
      submittedAt: new Date(),
      grade: 18,
      feedback: "Good approach and clear working.",
    },
    create: {
      schoolId: school.id,
      assignmentId: assignment.id,
      studentId: students[0].id,
      fileUrl: "https://example.com/student1-algebra-solutions.pdf",
      grade: 18,
      feedback: "Good approach and clear working.",
    },
  });
  console.log("Sample assignment, attachment, and submission created");

  // 13. Sample grades
  for (const s of students.slice(0, 2)) {
    await prisma.grade.upsert({
      where: {
        studentId_subjectId_term: {
          studentId: s.id,
          subjectId: mathSubject.id,
          term: "T1",
        },
      },
      update: {},
      create: {
        studentId: s.id,
        subjectId: mathSubject.id,
        term: "T1",
        marks: 85,
        maxMarks: 100,
        grade: "A",
      },
    });
  }
  console.log("Sample grades created");

  // 14. Sample exam and grading data
  const exam = await prisma.exam.upsert({
    where: { id: "cseedexam000000000000000001" },
    update: {},
    create: {
      id: "cseedexam000000000000000001",
      schoolId: school.id,
      classId: classEntity.id,
      academicYearId: academicYear.id,
      name: "Mid Term Examination",
      description: "Term 1 mid-term assessment",
      startDate: new Date("2025-10-15"),
      endDate: new Date("2025-10-20"),
      status: "completed",
    },
  });

  const examSubjectMath = await prisma.examSubject.upsert({
    where: { examId_subjectId: { examId: exam.id, subjectId: mathSubject.id } },
    update: {},
    create: {
      examId: exam.id,
      subjectId: mathSubject.id,
      maxMarks: 100,
      passMarks: 35,
    },
  });

  const examSubjectScience = await prisma.examSubject.upsert({
    where: { examId_subjectId: { examId: exam.id, subjectId: scienceSubject.id } },
    update: {},
    create: {
      examId: exam.id,
      subjectId: scienceSubject.id,
      maxMarks: 100,
      passMarks: 35,
    },
  });

  const marksSeed = [
    { student: students[0], math: 92, science: 88 },
    { student: students[1], math: 84, science: 79 },
  ];

  const gradeFromPercentage = (percent: number) => {
    if (percent >= 90) return "A+";
    if (percent >= 80) return "A";
    if (percent >= 70) return "B";
    if (percent >= 60) return "C";
    if (percent >= 50) return "D";
    return "F";
  };

  const gpaFromPercentage = (percent: number) => {
    if (percent >= 90) return 4.0;
    if (percent >= 80) return 3.6;
    if (percent >= 70) return 3.2;
    if (percent >= 60) return 2.8;
    if (percent >= 50) return 2.4;
    return 0.0;
  };

  for (const row of marksSeed) {
    await prisma.studentMark.upsert({
      where: {
        examSubjectId_studentId: { examSubjectId: examSubjectMath.id, studentId: row.student.id },
      },
      update: {
        marksObtained: row.math,
        grade: gradeFromPercentage(row.math),
        remarks: "Good performance",
      },
      create: {
        schoolId: school.id,
        examSubjectId: examSubjectMath.id,
        studentId: row.student.id,
        marksObtained: row.math,
        grade: gradeFromPercentage(row.math),
        remarks: "Good performance",
      },
    });

    await prisma.studentMark.upsert({
      where: {
        examSubjectId_studentId: { examSubjectId: examSubjectScience.id, studentId: row.student.id },
      },
      update: {
        marksObtained: row.science,
        grade: gradeFromPercentage(row.science),
        remarks: "Consistent effort",
      },
      create: {
        schoolId: school.id,
        examSubjectId: examSubjectScience.id,
        studentId: row.student.id,
        marksObtained: row.science,
        grade: gradeFromPercentage(row.science),
        remarks: "Consistent effort",
      },
    });

    const total = row.math + row.science;
    const percentage = Number(((total / 200) * 100).toFixed(2));

    await prisma.examResult.upsert({
      where: { examId_studentId: { examId: exam.id, studentId: row.student.id } },
      update: {
        totalMarks: total,
        percentage,
        gpa: gpaFromPercentage(percentage),
      },
      create: {
        schoolId: school.id,
        examId: exam.id,
        studentId: row.student.id,
        totalMarks: total,
        percentage,
        gpa: gpaFromPercentage(percentage),
      },
    });
  }

  const rankedResults = await prisma.examResult.findMany({
    where: { examId: exam.id },
    orderBy: [{ percentage: "desc" }, { totalMarks: "desc" }],
  });

  await prisma.$transaction(
    rankedResults.map((row, idx) =>
      prisma.examResult.update({ where: { id: row.id }, data: { rank: idx + 1 } })
    )
  );
  console.log("Sample exam, marks, and results created");

  // 15. Fee structures and payments
  const feeStructure = await prisma.feeStructure.upsert({
    where: { id: "seed-fee-1" },
    update: {
      schoolId: school.id,
      name: "Annual Fee Grade 9",
      amount: 50000,
      grade: 9,
      installments: 3,
      lateFeePercent: 5,
      discountPercent: 10,
    },
    create: {
      id: "seed-fee-1",
      schoolId: school.id,
      name: "Annual Fee Grade 9",
      amount: 50000,
      grade: 9,
      installments: 3,
      lateFeePercent: 5,
      discountPercent: 10,
    },
  });

  const activityFee = await prisma.feeStructure.upsert({
    where: { id: "seed-fee-2" },
    update: {
      schoolId: school.id,
      name: "Activity Fee",
      amount: 6000,
      grade: null,
      installments: 1,
      lateFeePercent: 2,
      discountPercent: null,
    },
    create: {
      id: "seed-fee-2",
      schoolId: school.id,
      name: "Activity Fee",
      amount: 6000,
      grade: null,
      installments: 1,
      lateFeePercent: 2,
      discountPercent: null,
    },
  });

  const paidDate = new Date();
  paidDate.setDate(paidDate.getDate() - 12);
  const overdueDate = new Date();
  overdueDate.setDate(overdueDate.getDate() - 20);
  const upcomingDate = new Date();
  upcomingDate.setDate(upcomingDate.getDate() + 12);

  await prisma.feePayment.upsert({
    where: { id: "seed-fee-payment-1" },
    update: {
      studentId: students[0].id,
      feeStructureId: feeStructure.id,
      amount: 15000,
      status: "paid",
      dueDate: paidDate,
      paidAt: paidDate,
      paymentMethod: "online",
      paymentReference: "TXN-SEED-001",
      notes: "First installment paid",
    },
    create: {
      id: "seed-fee-payment-1",
      studentId: students[0].id,
      feeStructureId: feeStructure.id,
      amount: 15000,
      status: "paid",
      dueDate: paidDate,
      paidAt: paidDate,
      paymentMethod: "online",
      paymentReference: "TXN-SEED-001",
      notes: "First installment paid",
    },
  });

  await prisma.feePayment.upsert({
    where: { id: "seed-fee-payment-2" },
    update: {
      studentId: students[0].id,
      feeStructureId: feeStructure.id,
      amount: 15000,
      status: "pending",
      dueDate: upcomingDate,
      paidAt: null,
      paymentMethod: null,
      paymentReference: null,
      notes: "Second installment pending",
    },
    create: {
      id: "seed-fee-payment-2",
      studentId: students[0].id,
      feeStructureId: feeStructure.id,
      amount: 15000,
      status: "pending",
      dueDate: upcomingDate,
      paidAt: null,
      paymentMethod: null,
      paymentReference: null,
      notes: "Second installment pending",
    },
  });

  await prisma.feePayment.upsert({
    where: { id: "seed-fee-payment-3" },
    update: {
      studentId: students[1].id,
      feeStructureId: feeStructure.id,
      amount: 15000,
      status: "overdue",
      dueDate: overdueDate,
      paidAt: null,
      paymentMethod: null,
      paymentReference: null,
      notes: "Installment overdue",
    },
    create: {
      id: "seed-fee-payment-3",
      studentId: students[1].id,
      feeStructureId: feeStructure.id,
      amount: 15000,
      status: "overdue",
      dueDate: overdueDate,
      paidAt: null,
      paymentMethod: null,
      paymentReference: null,
      notes: "Installment overdue",
    },
  });

  await prisma.feePayment.upsert({
    where: { id: "seed-fee-payment-4" },
    update: {
      studentId: students[2].id,
      feeStructureId: activityFee.id,
      amount: 6000,
      status: "pending",
      dueDate: upcomingDate,
      paidAt: null,
      paymentMethod: null,
      paymentReference: null,
      notes: "Activity fee due",
    },
    create: {
      id: "seed-fee-payment-4",
      studentId: students[2].id,
      feeStructureId: activityFee.id,
      amount: 6000,
      status: "pending",
      dueDate: upcomingDate,
      paidAt: null,
      paymentMethod: null,
      paymentReference: null,
      notes: "Activity fee due",
    },
  });

  console.log("Fee structures and payments created");

  // 16. Announcements
  const publishedDate = new Date();
  publishedDate.setDate(publishedDate.getDate() - 2);
  const expiredDate = new Date();
  expiredDate.setDate(expiredDate.getDate() - 1);
  const futureExpiry = new Date();
  futureExpiry.setDate(futureExpiry.getDate() + 14);

  await prisma.announcement.upsert({
    where: { id: "seed-announcement-1" },
    update: {
      schoolId: school.id,
      title: "Welcome to SchoolOS",
      body: "This is a demo platform. CareerBuddy assessments are available for Grade 9 and 10.",
      priority: "high",
      audience: "all",
      isPublished: true,
      publishedAt: publishedDate,
      expiresAt: futureExpiry,
    },
    create: {
      id: "seed-announcement-1",
      schoolId: school.id,
      title: "Welcome to SchoolOS",
      body: "This is a demo platform. CareerBuddy assessments are available for Grade 9 and 10.",
      priority: "high",
      audience: "all",
      isPublished: true,
      publishedAt: publishedDate,
      expiresAt: futureExpiry,
    },
  });

  await prisma.announcement.upsert({
    where: { id: "seed-announcement-2" },
    update: {
      schoolId: school.id,
      title: "Mid-term Report Cards This Week",
      body: "Students can view mid-term report cards in the results section. Parents may review them in the parent portal.",
      priority: "normal",
      audience: "students",
      isPublished: true,
      publishedAt: publishedDate,
      expiresAt: futureExpiry,
    },
    create: {
      id: "seed-announcement-2",
      schoolId: school.id,
      title: "Mid-term Report Cards This Week",
      body: "Students can view mid-term report cards in the results section. Parents may review them in the parent portal.",
      priority: "normal",
      audience: "students",
      isPublished: true,
      publishedAt: publishedDate,
      expiresAt: futureExpiry,
    },
  });

  await prisma.announcement.upsert({
    where: { id: "seed-announcement-3" },
    update: {
      schoolId: school.id,
      title: "Parent Orientation Invite",
      body: "Parents are invited to the monthly orientation and Q&A session this Friday at 5 PM.",
      priority: "high",
      audience: "parents",
      isPublished: true,
      publishedAt: publishedDate,
      expiresAt: futureExpiry,
    },
    create: {
      id: "seed-announcement-3",
      schoolId: school.id,
      title: "Parent Orientation Invite",
      body: "Parents are invited to the monthly orientation and Q&A session this Friday at 5 PM.",
      priority: "high",
      audience: "parents",
      isPublished: true,
      publishedAt: publishedDate,
      expiresAt: futureExpiry,
    },
  });

  await prisma.announcement.upsert({
    where: { id: "seed-announcement-4" },
    update: {
      schoolId: school.id,
      title: "Annual Day Practice Schedule",
      body: "Practice schedule has been drafted and will be shared after faculty confirmation.",
      priority: "low",
      audience: "all",
      isPublished: false,
      publishedAt: null,
      expiresAt: null,
    },
    create: {
      id: "seed-announcement-4",
      schoolId: school.id,
      title: "Annual Day Practice Schedule",
      body: "Practice schedule has been drafted and will be shared after faculty confirmation.",
      priority: "low",
      audience: "all",
      isPublished: false,
      publishedAt: null,
      expiresAt: null,
    },
  });

  await prisma.announcement.upsert({
    where: { id: "seed-announcement-5" },
    update: {
      schoolId: school.id,
      title: "Old Circular",
      body: "This circular is retained in seed data to validate expiry filtering in announcement feeds.",
      priority: "low",
      audience: "all",
      isPublished: true,
      publishedAt: publishedDate,
      expiresAt: expiredDate,
    },
    create: {
      id: "seed-announcement-5",
      schoolId: school.id,
      title: "Old Circular",
      body: "This circular is retained in seed data to validate expiry filtering in announcement feeds.",
      priority: "low",
      audience: "all",
      isPublished: true,
      publishedAt: publishedDate,
      expiresAt: expiredDate,
    },
  });
  console.log("Announcements created");

  console.log("Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
