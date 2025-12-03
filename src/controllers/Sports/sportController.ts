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
    const body = await c.req.json();
    const { 
      studentId, 
      activityId, 
      status = 'present', 
      processedBy = 'System'
    } = body;

    console.log('[DEBUG] Mark attendance request:', { 
      studentId, 
      activityId, 
      status, 
      processedBy 
    });

    if (!studentId || !activityId) {
      return c.json({
        success: false,
        error: 'Missing studentId or activityId',
      }, 400);
    }

    // Find the student with user session info
    const user = await prisma.user.findUnique({
      where: { id: Number(studentId) },
      select: {
        id: true,
        fname: true,
        lname: true,
        email: true,
        guardianemail: true,
        guardianname: true,
      },
    });

    if (!user) {
      return c.json({
        success: false,
        error: 'Student not found',
      }, 404);
    }

    // Find the activity
    const activity = await prisma.afterschoolactivity.findUnique({
      where: { id: Number(activityId) },
      select: {
        id: true,
        name: true,
        rate: true,
      },
    });

    if (!activity) {
      return c.json({
        success: false,
        error: 'Activity not found',
      }, 404);
    }

    // Find user session for this activity
    const userSession = await prisma.usersession.findFirst({
      where: {
        userId: user.id,
        activityId: Number(activityId),
      },
    });

    if (!userSession) {
      return c.json({
        success: false,
        error: 'User session not found for this activity',
      }, 404);
    }

    // Check if no sessions remaining (only for 'present' status)
    if (status === 'present' && userSession.sessionsRemaining <= 0) {
      return c.json({
        success: false,
        error: 'No sessions remaining for this student',
      }, 400);
    }

    // Find today's session for this activity
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let activitySession = await prisma.activitysession.findFirst({
      where: {
        activityId: Number(activityId),
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    // If no session exists for today, create one
    if (!activitySession) {
      activitySession = await prisma.activitysession.create({
        data: {
          activityId: Number(activityId),
          date: today,
          updatedAt: new Date(),
        },
      });
    }

    // Check if attendance already exists for today
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        userId: user.id,
        sessionId: activitySession.id,
        createdAt: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    if (existingAttendance) {
      return c.json({
        success: false,
        error: 'Attendance already marked for today',
      }, 400);
    }

    // STEP 1: Update session FIRST (if status is 'present')
    let updatedSession = null;
    if (status === 'present') {
      // Update sessions by incrementing attended and decrementing remaining
      updatedSession = await prisma.usersession.update({
        where: { id: userSession.id },
        data: {
          sessionsAttended: { increment: 1 },
          sessionsRemaining: { decrement: 1 },
          updatedAt: new Date(),
        },
      });
      console.log('[DEBUG] Sessions updated:', updatedSession);
    }

    // STEP 2: Create attendance record AFTER updating sessions
    const attendance = await prisma.attendance.create({
      data: {
        sessionId: activitySession.id,
        userId: user.id,
        status,
        processedBy,
      },
    });

    console.log('[DEBUG] Attendance created:', attendance.id);

    // STEP 3: Fetch CURRENT session data for email (fetch fresh from database)
    const currentSessionData = await prisma.usersession.findFirst({
      where: {
        userId: user.id,
        activityId: Number(activityId),
      },
    });

    if (!currentSessionData) {
      return c.json({
        success: false,
        error: 'Failed to fetch current session data',
      }, 500);
    }

    console.log('[DEBUG] Current session data for email:', {
      purchased: currentSessionData.sessionsPurchased,
      attended: currentSessionData.sessionsAttended,
      remaining: currentSessionData.sessionsRemaining
    });

    // STEP 4: Send email with CURRENT session data
    let emailSent = false;
    try {
      const studentName = `${user.fname} ${user.lname}`;
      const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Prepare email options with CURRENT session data
      const emailOptions = {
        studentName,
        studentEmail: user.email || '',
        activityName: activity.name,
        status,
        date: currentDate,
        guardianEmail: user.guardianemail || undefined,
        sessionsRemaining: currentSessionData.sessionsRemaining,
        sessionsAttended: currentSessionData.sessionsAttended,
        sessionsPurchased: currentSessionData.sessionsPurchased,
      };

      console.log('[DEBUG] Sending email with CURRENT session data:', {
        remaining: emailOptions.sessionsRemaining,
        attended: emailOptions.sessionsAttended,
        purchased: emailOptions.sessionsPurchased
      });
      
      emailSent = await sendAttendanceEmail(emailOptions);
      
      if (emailSent) {
        console.log('[DEBUG] Email sent successfully with current session counts');
      } else {
        console.log('[WARN] Email sending failed');
      }
    } catch (emailError) {
      console.error('[ERROR] Failed to send email:', emailError);
      emailSent = false;
    }

    return c.json({
      success: true,
      message: `Attendance marked as ${status}${status === 'present' ? ' and payment deducted successfully' : ''}`,
      data: {
        attendance,
        updatedSession: status === 'present' ? updatedSession : null,
        currentSessionData: {
          sessionsPurchased: currentSessionData.sessionsPurchased,
          sessionsAttended: currentSessionData.sessionsAttended,
          sessionsRemaining: currentSessionData.sessionsRemaining,
        },
        deductedAmount: status === 'present' ? activity.rate : 0,
        processedBy,
        emailSent,
      },
    });

  } catch (error) {
    console.error('[ERROR] Error marking attendance and deducting payment:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
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
        studentName: `${user?.fname || ''} ${user?.mname || ''} ${user?.lname || ''}`.replace(/\s+/g, ' ').trim(),
        rfid: user?.rfid?.toString() || "",
        activity: activity?.name || 'Unknown Activity',
        date: session?.date ? session.date.toISOString().split('T')[0] : '',
        time: record.createdAt.toISOString(),
        status: record.status || 'absent',
        processedBy: record.processedBy || null, // Add this line
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

export const updateSportController = async (c: Context): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { 
      id, 
      name, 
      description, 
      dayOfWeek, 
      startTime, 
      endTime, 
      location, 
      coachName, 
      photo, 
      rate 
    } = body;

    // Validate required fields
    if (!id) {
      return c.json({
        success: false,
        error: 'Sport ID is required',
      }, 400);
    }

    if (!name || !dayOfWeek || !startTime || !endTime) {
      return c.json({
        success: false,
        error: 'Missing required fields: name, dayOfWeek, startTime, and endTime are required',
      }, 400);
    }

    // Check if sport exists
    const existingSport = await prisma.afterschoolactivity.findUnique({
      where: { id: Number(id) },
    });

    if (!existingSport) {
      return c.json({
        success: false,
        error: 'Sport not found',
      }, 404);
    }

    // Prepare update data
    const updateData: any = {
      name,
      description: description || '',
      dayOfWeek,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      location: location || 'Westfields International School',
      coachName: coachName || '',
      photo: photo || '',
      rate: Number(rate) || 0,
      updatedAt: new Date(),
    };

    // Try to update the activity
    const updatedActivity = await prisma.afterschoolactivity.update({
      where: { id: Number(id) },
      data: updateData,
    });

    console.log('[DEBUG] Sport updated successfully:', {
      id: updatedActivity.id,
      name: updatedActivity.name,
      updatedAt: updatedActivity.updatedAt,
    });

    return c.json({
      success: true,
      data: updatedActivity,
      message: 'Sport updated successfully',
    });
  } catch (error: any) {
    console.error('[ERROR] Error updating sport:', error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return c.json({
        success: false,
        error: 'An activity with this name and start time already exists.',
      }, 409);
    }

    // Handle record not found
    if (error.code === 'P2025') {
      return c.json({
        success: false,
        error: 'Sport not found',
      }, 404);
    }

    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

export const deleteSportController = async (c: Context): Promise<Response> => {
  try {
    const id = Number(c.req.param('id'));
    
    if (isNaN(id)) {
      return c.json({
        success: false,
        error: 'Invalid sport ID',
      }, 400);
    }

    // Check if sport exists
    const existingSport = await prisma.afterschoolactivity.findUnique({
      where: { id },
    });

    if (!existingSport) {
      return c.json({
        success: false,
        error: 'Sport not found',
      }, 404);
    }

    // Check if there are enrollments for this sport
    const enrollments = await prisma.enrolledactivity.findMany({
      where: { activityId: id },
    });

    if (enrollments.length > 0) {
      return c.json({
        success: false,
        error: 'Cannot delete sport with active enrollments. Please remove all enrollments first.',
      }, 400);
    }

    // Check if there are activity sessions for this sport
    const sessions = await prisma.activitysession.findMany({
      where: { activityId: id },
    });

    if (sessions.length > 0) {
      return c.json({
        success: false,
        error: 'Cannot delete sport with existing sessions. Please delete all sessions first.',
      }, 400);
    }

    // Delete the sport
    await prisma.afterschoolactivity.delete({
      where: { id },
    });

    console.log('[DEBUG] Sport deleted successfully:', { id });

    return c.json({
      success: true,
      message: 'Sport deleted successfully',
    });
  } catch (error: any) {
    console.error('[ERROR] Error deleting sport:', error);

    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};