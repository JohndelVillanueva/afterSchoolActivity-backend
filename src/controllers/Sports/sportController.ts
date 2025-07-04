import { type Context } from 'hono';
// @ts-ignore
import { PrismaClient } from '@prisma/client';
import { uploadFile } from '../../fileManager.js';

const prisma = new PrismaClient();

// Simple function to generate unique filenames
function generateUniqueFilename(extension: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}.${extension}`;
}

export const createSportController = async (c: Context): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { name, description, dayOfWeek, startTime, endTime, location, coachName, photo } = body;

    if (!name || !dayOfWeek || !startTime || !endTime) {
      return c.json({
        success: false,
        error: 'Missing required fields',
      }, 400);
    }

    const newActivity = await prisma.afterschoolactivity.create({
      data: {
        name,
        description,
        dayOfWeek,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        location,
        coachName,
        photo,
        updatedAt: new Date(),
      },
    });

    return c.json({
      success: true,
      data: newActivity,
    }, 201);
  } catch (error) {
    console.error('[ERROR] Error creating sport:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

export const getAllSportsController = async (c: Context): Promise<Response> => {
  try {
    const activities = await prisma.afterschoolactivity.findMany();
    return c.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    console.error('[ERROR] Error fetching sports:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

export const uploadPhotoController = async (c: Context): Promise<Response> => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('photo') as File;
    
    if (!file) {
      return c.json({
        success: false,
        error: 'No photo file provided',
      }, 400);
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return c.json({
        success: false,
        error: 'File must be an image',
      }, 400);
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const filename = generateUniqueFilename(fileExtension);
    
    // Convert file to buffer and upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    await uploadFile(filename, buffer);
    
    // Return the file path for storage in database
    const photoUrl = `/uploads/${filename}`;
    
    console.log('[DEBUG] Photo uploaded successfully:', {
      filename,
      photoUrl,
      fileSize: buffer.length
    });
    
    return c.json({
      success: true,
      data: { photoUrl },
    });
  } catch (error) {
    console.error('[ERROR] Error uploading photo:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

export const getEnrolledStudentsController = async (c: Context): Promise<Response> => {
  try {
    const activityId = Number(c.req.param('id'));
    if (isNaN(activityId)) {
      return c.json({ success: false, error: 'Invalid activity ID' }, 400);
    }

    const enrollments = await prisma.enrolledactivity.findMany({
      where: { activityId },
      include: {
        user: true,
      },
    });

    // For each student, fetch their wispay balance
    const students = await Promise.all(enrollments.map(async e => {
      let balance = 0;
      if (e.user.rfid) {
        const wispay = await prisma.wispay.aggregate({
          where: { rfid: BigInt(e.user.rfid) },
          _sum: {
            credit: true,
            debit: true,
          },
        });
        balance = Number(wispay._sum.credit || 0) - Number(wispay._sum.debit || 0);
      }
      return {
        id: e.user.id,
        name: `${e.user.fname} ${e.user.lname}`.trim(),
        grade: e.user.grade,
        registeredOn: e.enrollmentDate,
        rfid: e.user.rfid?.toString(),
        balance,
      };
    }));

    return c.json({ success: true, data: students });
  } catch (error) {
    console.error('[ERROR] Error fetching enrolled students:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }, 500);
  }
};

export const getActivityByIdController = async (c: Context): Promise<Response> => {
  try {
    const id = Number(c.req.param('id'));
    if (isNaN(id)) {
      return c.json({ success: false, error: 'Invalid activity ID' }, 400);
    }
    const activity = await prisma.afterschoolactivity.findUnique({
      where: { id },
    });
    if (!activity) {
      return c.json({ success: false, error: 'Activity not found' }, 404);
    }
    return c.json({ success: true, data: activity });
  } catch (error) {
    console.error('[ERROR] Error fetching activity by ID:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }, 500);
  }
};

export const markAttendanceAndDeductController = async (c: Context): Promise<Response> => {
  try {
    const { studentId, activityId } = await c.req.json();
    if (!studentId || !activityId) {
      return c.json({ success: false, error: 'Missing studentId or activityId' }, 400);
    }

    // Get student and activity
    const user = await prisma.user.findUnique({ where: { id: Number(studentId) } });
    const activity = await prisma.afterschoolactivity.findUnique({
      where: { id: Number(activityId) },
      select: { id: true, name: true, rate: true },
    });
    if (!user || !activity) {
      return c.json({ success: false, error: 'Student or activity not found' }, 404);
    }

    // Check if student is enrolled in the activity
    const enrollment = await prisma.enrolledactivity.findFirst({
      where: { userId: user.id, activityId: activity.id },
    });
    if (!enrollment) {
      return c.json({ success: false, error: 'Student is not enrolled in this activity.' }, 400);
    }

    // Find or create today's activitysession for this activity
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let session = await prisma.activitysession.findFirst({
      where: {
        activityId: activity.id,
        date: today,
      }
    });
    if (!session) {
      session = await prisma.activitysession.create({
        data: {
          activityId: activity.id,
          date: today,
          updatedAt: new Date(),
        },
      });
    }

    // Check if session is still null (should not happen, but for safety)
    if (!session) {
      return c.json({ success: false, error: 'Could not create or find session.' }, 500);
    }

    // Check if attendance already exists for this student in this session
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        sessionId: session.id,
        userId: user.id,
      },
    });

    if (existingAttendance) {
      return c.json({ success: false, error: 'Attendance already recorded for today.' }, 400);
    }

    // Debug log
    console.log('Deducting from wispay:', {
      rfid: user.rfid,
      debit: activity['rate'],
      activity,
      user
    });

    // Deduct rate from wispay (create a debit transaction)
    await prisma.wispay.create({
      data: {
        rfid: BigInt(user.rfid),
        debit: activity['rate'],
        credit: 0,
        empid: '',
        username: '',
        refcode: `ATTEND-${activityId}-${studentId}-${Date.now()}`,
        transdate: new Date(),
        processedby: '',
        product_type: 'AfterSchool',
        product_name: activity.name,
        quantity: 1,
        isAfterSchoolPayment: true,
      }
    });

    // Mark attendance for the student in this session
    await prisma.attendance.upsert({
      where: {
        sessionId_userId: {
          sessionId: session.id,
          userId: user.id,
        },
      },
      update: { status: 'present' },
      create: {
        sessionId: session.id,
        userId: user.id,
        status: 'present',
      },
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('[ERROR] Mark attendance and deduct:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }, 500);
  }
};

export const getTodayAttendanceController = async (c: Context): Promise<Response> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Find all activity sessions for today
    const sessions = await prisma.activitysession.findMany({
      where: {
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        afterschoolactivity: true,
        attendance: {
          include: {
            user: true,
          },
        },
      },
    });

    // Flatten attendance records
    const attendanceRecords = sessions.flatMap(session =>
      session.attendance.map(record => ({
        id: record.userId.toString(),
        studentName: `${record.user.fname} ${record.user.mname} ${record.user.lname}`.replace(/\s+/g, ' ').trim(),
        rfid: record.user.rfid ? record.user.rfid.toString() : "",
        activity: session.afterschoolactivity.name,
        date: session.date.toISOString().split('T')[0],
        time: '', // Optionally add time if you store it
        status: record.status,
      }))
    );

    return c.json({ success: true, data: attendanceRecords });
  } catch (error) {
    console.error('[ERROR] Fetching today attendance:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }, 500);
  }
};

export const getAllAttendanceTransactionsController = async (c: Context): Promise<Response> => {
  try {
    // Get all wispay transactions that are afterschool payments
    const wispayTransactions = await prisma.wispay.findMany({
      where: {
        isAfterSchoolPayment: true,
      },
      orderBy: {
        transdate: 'desc',
      },
    });

    // Get all attendance records with user and activity info
    const sessions = await prisma.activitysession.findMany({
      include: {
        afterschoolactivity: true,
        attendance: {
          include: {
            user: true,
          },
        },
      },
    });

    // Create a map of attendance records by session and user
    const attendanceMap = new Map();
    sessions.forEach(session => {
      session.attendance.forEach(record => {
        const { createdAt, user, status } = record as any;
        const key = `${session.afterschoolactivity.name}-${user.rfid?.toString()}-${session.date.toISOString().split('T')[0]}`;
        attendanceMap.set(key, {
          studentName: `${user.fname} ${user.mname} ${user.lname}`.replace(/\s+/g, ' ').trim(),
          rfid: user.rfid?.toString() || "",
          activity: session.afterschoolactivity.name,
          date: session.date.toISOString().split('T')[0],
          time: createdAt ? createdAt.toISOString() : '',
          status: status,
        });
      });
    });

    // Combine wispay transactions with attendance info
    const allTransactions = await Promise.all(wispayTransactions.map(async transaction => {
      const rfid = transaction.rfid.toString();
      const date = transaction.transdate.toISOString().split('T')[0];
      
      // Try to find matching attendance record
      let attendanceInfo = null;
      for (const [key, value] of attendanceMap.entries()) {
        if (key.includes(rfid) && key.includes(date)) {
          attendanceInfo = value;
          break;
        }
      }

      // Try to get the real student name if not found in attendance
      let studentName = attendanceInfo?.studentName;
      if (!studentName) {
        const user = await prisma.user.findFirst({
          where: { rfid: BigInt(rfid) }
        });
        if (user) {
          studentName = `${user.fname} ${user.mname} ${user.lname}`.replace(/\s+/g, ' ').trim();
        } else {
          studentName = `RFID: ${rfid}`;
        }
      }

      return {
        id: transaction.id.toString(),
        studentName,
        rfid,
        activity: transaction.product_name || 'Unknown Activity',
        date,
        time: transaction.transdate.toISOString(),
        status: attendanceInfo?.status || 'payment',
        credit: Number(transaction.credit || 0),
        debit: Number(transaction.debit || 0),
        refcode: transaction.refcode,
        transdate: transaction.transdate,
      };
    }));

    return c.json({ success: true, data: allTransactions });
  } catch (error) {
    console.error('[ERROR] Fetching all attendance transactions:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }, 500);
  }
}; 