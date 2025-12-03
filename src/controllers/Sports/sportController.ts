import { type Context } from 'hono';
// @ts-ignore
import { PrismaClient } from '@prisma/client';
import { uploadFile } from '../../fileManager.js';
import { sendAttendanceEmail } from '../../services/emailServices.js';

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
    const { name, description, dayOfWeek, startTime, endTime, location, coachName, photo, rate } = body;

    if (!name || !dayOfWeek || !startTime || !endTime) {
      return c.json({
        success: false,
        error: 'Missing required fields',
      }, 400);
    }

    // Try to create the activity
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
        rate,
        updatedAt: new Date(),
      },
    });

    return c.json({
      success: true,
      data: newActivity,
    }, 201);
  } catch (error: any) {
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return c.json({
        success: false,
        error: 'An activity with this name and start time already exists.',
      }, 409);
    }
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
    const { studentId, activityId, status } = await c.req.json();
    if (!studentId || !activityId || !status) {
      return c.json({ success: false, error: 'Missing studentId, activityId, or status' }, 400);
    }

    // Validate status
    if (status !== 'present' && status !== 'absent') {
      return c.json({ success: false, error: 'Status must be either "present" or "absent"' }, 400);
    }

    // Get student and activity with additional email fields
    const user = await prisma.user.findUnique({ 
      where: { id: Number(studentId) },
      select: {
        id: true,
        rfid: true,
        fname: true,
        mname: true,
        lname: true,
        email: true,
        guardianemail: true, // Guardian email for notifications
      }
    });
    
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

    // Check user session BEFORE marking attendance
    const userSession = await prisma.usersession.findUnique({
      where: {
        userId_activityId: {
          userId: user.id,
          activityId: activity.id,
        }
      }
    });

    // Validate if student has sessions remaining
    if (userSession) {
      // Check if sessions remaining is 0 or if attended equals purchased
      if (userSession.sessionsRemaining <= 0 || userSession.sessionsAttended >= userSession.sessionsPurchased) {
        return c.json({ 
          success: false, 
          error: 'No sessions remaining. Student has used all purchased sessions. Please purchase more sessions to continue.',
          details: {
            sessionsPurchased: userSession.sessionsPurchased,
            sessionsAttended: userSession.sessionsAttended,
            sessionsRemaining: userSession.sessionsRemaining
          }
        }, 400);
      }
    }

    // Mark attendance for the student in this session with the provided status
    await prisma.attendance.upsert({
      where: {
        sessionId_userId: {
          sessionId: session.id,
          userId: user.id,
        },
      },
      update: { status: status },
      create: {
        sessionId: session.id,
        userId: user.id,
        status: status,
      },
    });

    console.log(`[DEBUG] Attendance marked as ${status} for student:`, user.id);

    // Update usersession to increment sessionsAttended and decrement sessionsRemaining
    let updatedSessionData = {
      sessionsAttended: 1,
      sessionsRemaining: 0,
      sessionsPurchased: 0
    };

    if (userSession) {
      const newSessionsAttended = userSession.sessionsAttended + 1;
      const newSessionsRemaining = Math.max(0, userSession.sessionsRemaining - 1);
      
      await prisma.usersession.update({
        where: { id: userSession.id },
        data: {
          sessionsAttended: newSessionsAttended,
          sessionsRemaining: newSessionsRemaining,
          updatedAt: new Date(),
        },
      });
      
      updatedSessionData = {
        sessionsAttended: newSessionsAttended,
        sessionsRemaining: newSessionsRemaining,
        sessionsPurchased: userSession.sessionsPurchased
      };
      
      console.log(`[DEBUG] User session updated for ${status}: sessionsAttended=${newSessionsAttended}, sessionsRemaining=${newSessionsRemaining}`);
    } else {
      await prisma.usersession.create({
        data: {
          userId: user.id,
          activityId: activity.id,
          sessionId: session.id,
          sessionsPurchased: 0,
          sessionsAttended: 1,
          sessionsRemaining: 0,
        },
      });
      console.log(`[DEBUG] User session created with sessionsAttended = 1 for ${status}`);
    }

    // Send email notification
    const studentName = `${user.fname} ${user.mname || ''} ${user.lname}`.trim();
    const dateString = today.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Check if student has an email
    if (user.email && user.email.trim()) {
      console.log(`[DEBUG] Sending attendance email to: ${user.email}`);
      
      const emailSent = await sendAttendanceEmail({
        studentName,
        studentEmail: user.email,
        guardianEmail: user.guardianemail || undefined,
        activityName: activity.name,
        status,
        date: dateString,
        sessionsRemaining: updatedSessionData.sessionsRemaining,
        sessionsAttended: updatedSessionData.sessionsAttended,
        sessionsPurchased: updatedSessionData.sessionsPurchased,
      });

      if (emailSent) {
        console.log(`[DEBUG] Email sent successfully to ${user.email}`);
      } else {
        console.warn(`[WARN] Failed to send email to ${user.email}`);
      }
    } else {
      console.warn(`[WARN] Student ${user.id} has no email address. Skipping email notification.`);
    }

    return c.json({ 
      success: true,
      message: `Attendance marked as ${status} successfully`,
      data: {
        studentId: user.id,
        activityId: activity.id,
        sessionDate: today.toISOString().split('T')[0],
        status: status,
        emailSent: !!(user.email && user.email.trim()),
      }
    });
  } catch (error) {
    console.error('[ERROR] Mark attendance and deduct:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, 500);
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
    // Get all attendance records with user, session, and activity info
    const attendanceRecords = await prisma.attendance.findMany({
      include: {
        user: true,
        activitysession: {
          include: {
            afterschoolactivity: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform the data to match the frontend expected format
    const transformedRecords = attendanceRecords.map(record => {
      const user = record.user;
      const session = record.activitysession;
      const activity = session?.afterschoolactivity;

      return {
        id: record.id.toString(),
        studentName: `${user.fname || ''} ${user.mname || ''} ${user.lname || ''}`.replace(/\s+/g, ' ').trim(),
        rfid: user.rfid?.toString() || "",
        activity: activity?.name || 'Unknown Activity',
        date: session?.date ? session.date.toISOString().split('T')[0] : '',
        time: record.createdAt.toISOString(),
        status: record.status || 'absent',
      };
    });

    return c.json({ 
      success: true, 
      data: transformedRecords 
    });
  } catch (error) {
    console.error('[ERROR] Fetching all attendance transactions:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, 500);
  }
};