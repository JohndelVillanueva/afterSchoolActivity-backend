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
    const { name, description, coachName, photo } = body;

    if (!name || !coachName || !description) {
      return c.json({
        success: false,
        error: 'Missing required fields: name, coachName, and description are required',
      }, 400);
    }

    // Try to create the activity
    const newActivity = await prisma.afterschoolactivity.create({
      data: {
        name,
        description,
        coachName,
        photo: photo || null,
        updatedAt: new Date(),
      } as any,
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
      processedBy = 'System',
      date  // ✅ NEW: Accept date parameter
    } = body;

    console.log('[DEBUG] Mark attendance request:', { 
      studentId, 
      activityId, 
      status, 
      processedBy,
      date 
    });

    if (!studentId || !activityId) {
      return c.json({
        success: false,
        error: 'Missing studentId or activityId',
      }, 400);
    }

    // ✅ Parse the target date (default to today if not provided)
    let targetDate = new Date();
    if (date) {
      targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        return c.json({
          success: false,
          error: 'Invalid date format',
        }, 400);
      }
    }
    targetDate.setHours(0, 0, 0, 0);

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

    // ✅ Find or create session for the TARGET DATE (not today)
    let activitySession = await prisma.activitysession.findFirst({
      where: {
        activityId: Number(activityId),
        date: {
          gte: targetDate,
          lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    // If no session exists for the target date, create one
    if (!activitySession) {
      activitySession = await prisma.activitysession.create({
        data: {
          activityId: Number(activityId),
          date: targetDate,
          updatedAt: new Date(),
        },
      });
    }

    // ✅ Check if attendance already exists for THIS SESSION (not by createdAt)
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        userId: user.id,
        sessionId: activitySession.id,  // ✅ Only check by sessionId
      },
    });

    if (existingAttendance) {
      return c.json({
        success: false,
        error: 'Attendance already marked for this date',
      }, 400);
    }

    // STEP 1: Update session FIRST (if status is 'present')
    let updatedSession = null;
    if (status === 'present') {
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

    // STEP 2: Create attendance record
    const attendance = await prisma.attendance.create({
      data: {
        sessionId: activitySession.id,
        userId: user.id,
        status,
        processedBy,
      },
    });

    console.log('[DEBUG] Attendance created:', attendance.id);

    // STEP 3: Fetch current session data for email
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

    // STEP 4: Send email
    let emailSent = false;
    try {
      const studentName = `${user.fname} ${user.lname}`;
      const currentDate = targetDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

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

      emailSent = await sendAttendanceEmail(emailOptions);
      
      if (emailSent) {
        console.log('[DEBUG] Email sent successfully');
      }
    } catch (emailError) {
      console.error('[ERROR] Failed to send email:', emailError);
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

export const getStudentsWithSessionsController = async (c: Context): Promise<Response> => {
  try {
    const activityId = Number(c.req.param('id'));
    const dateParam = c.req.query('date'); // Get date from query parameter
    
    if (isNaN(activityId)) {
      return c.json({ 
        success: false, 
        error: 'Invalid activity ID' 
      }, 400);
    }

    // Parse the date or use today
    let targetDate = new Date();
    if (dateParam) {
      targetDate = new Date(dateParam);
      if (isNaN(targetDate.getTime())) {
        return c.json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
        }, 400);
      }
    }
    
    // Set to start of day
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

    // Get the activity details
    const activity = await prisma.afterschoolactivity.findUnique({
      where: { id: activityId },
    });

    if (!activity) {
      return c.json({ 
        success: false, 
        error: 'Activity not found' 
      }, 404);
    }

    // Check if the selected date matches the activity's day of week
    const selectedDayName = targetDate.toLocaleDateString('en-US', { weekday: 'long' });
    const isCorrectDay = activity.dayOfWeek === selectedDayName;

    // Get all enrollments for this activity with user and session data
    const enrollments = await prisma.enrolledactivity.findMany({
      where: { activityId },
      include: {
        user: {
          select: {
            id: true,
            rfid: true,
            fname: true,
            mname: true,
            lname: true,
            email: true,
            grade: true,
            position: true,
            isEnrolledInAfterSchool: true,
          },
        },
      },
    });

    // For each enrollment, get their session data and attendance for the selected date
    const studentsWithSessions = await Promise.all(
      enrollments.map(async (enrollment) => {
        const userSession = await prisma.usersession.findFirst({
          where: {
            userId: enrollment.userId,
            activityId: activityId,
          },
        });

        // Get attendance for the selected date
        const dateSession = await prisma.activitysession.findFirst({
          where: {
            activityId: activityId,
            date: {
              gte: targetDate,
              lt: nextDay,
            },
          },
        });

        let dateAttendance = null;
        if (dateSession) {
          dateAttendance = await prisma.attendance.findFirst({
            where: {
              userId: enrollment.userId,
              sessionId: dateSession.id,
            },
          });
        }

        return {
          id: enrollment.user.id,
          rfid: enrollment.user.rfid?.toString() || '',
          fname: enrollment.user.fname,
          mname: enrollment.user.mname,
          lname: enrollment.user.lname,
          email: enrollment.user.email,
          grade: enrollment.user.grade,
          enrolledDate: enrollment.enrollmentDate,
          sessionsPurchased: userSession?.sessionsPurchased || 0,
          sessionsAttended: userSession?.sessionsAttended || 0,
          sessionsRemaining: userSession?.sessionsRemaining || 0,
          hasAttendanceOnDate: !!dateAttendance,
          dateAttendanceStatus: dateAttendance?.status || null,
          dateAttendanceTime: dateAttendance?.createdAt || null,
          processedBy: dateAttendance?.processedBy || null,
        };
      })
    );

    return c.json({
      success: true,
      data: {
        activity: {
          id: activity.id,
          name: activity.name,
          dayOfWeek: activity.dayOfWeek,
          startTime: activity.startTime,
          endTime: activity.endTime,
          location: activity.location,
          coachName: activity.coachName,
          rate: activity.rate,
        },
        selectedDate: targetDate.toISOString().split('T')[0],
        isCorrectDay,
        selectedDayName,
        students: studentsWithSessions,
        summary: {
          totalEnrolled: studentsWithSessions.length,
          presentOnDate: studentsWithSessions.filter(s => s.dateAttendanceStatus === 'present').length,
          absentOnDate: studentsWithSessions.filter(s => s.dateAttendanceStatus === 'absent').length,
          notMarked: studentsWithSessions.filter(s => !s.hasAttendanceOnDate).length,
        },
      },
    });
  } catch (error) {
    console.error('[ERROR] Error fetching students with sessions:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

/**
 * Get weekly schedule view for all activities
 * Shows which activities are happening on which days
 */
export const getWeeklyScheduleController = async (c: Context): Promise<Response> => {
  try {
    // Get all activities
    const activities = await prisma.afterschoolactivity.findMany({
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' },
      ],
    });

    // Get enrollment counts for each activity
    const activitiesWithCounts = await Promise.all(
      activities.map(async (activity) => {
        const enrollmentCount = await prisma.enrolledactivity.count({
          where: { activityId: activity.id },
        });

        // Get today's attendance count if it's the activity's day
        const today = new Date();
        const todayDayName = today.toLocaleDateString('en-US', { weekday: 'long' });
        
        let attendanceCount = 0;
        if (activity.dayOfWeek === todayDayName) {
          today.setHours(0, 0, 0, 0);
          
          const todaySession = await prisma.activitysession.findFirst({
            where: {
              activityId: activity.id,
              date: {
                gte: today,
                lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
              },
            },
          });

          if (todaySession) {
            attendanceCount = await prisma.attendance.count({
              where: {
                sessionId: todaySession.id,
                status: 'present',
              },
            });
          }
        }

        return {
          ...activity,
          enrollmentCount,
          attendanceToday: attendanceCount,
          isToday: activity.dayOfWeek === todayDayName,
        };
      })
    );

    // Group by day of week
    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const groupedByDay: { [key: string]: typeof activitiesWithCounts } = {};
    
    daysOrder.forEach(day => {
      groupedByDay[day] = activitiesWithCounts.filter(a => a.dayOfWeek === day);
    });

    return c.json({
      success: true,
      data: {
        schedule: groupedByDay,
        allActivities: activitiesWithCounts,
        summary: {
          totalActivities: activities.length,
          totalEnrollments: activitiesWithCounts.reduce((sum, a) => sum + a.enrollmentCount, 0),
          activitiesToday: activitiesWithCounts.filter(a => a.isToday).length,
          attendanceToday: activitiesWithCounts.reduce((sum, a) => sum + a.attendanceToday, 0),
        },
      },
    });
  } catch (error) {
    console.error('[ERROR] Error fetching weekly schedule:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

/**
 * Get attendance history for a specific date range
 * Useful for generating reports
 */
export const getAttendanceByDateRangeController = async (c: Context): Promise<Response> => {
  try {
    const startDateParam = c.req.query('startDate');
    const endDateParam = c.req.query('endDate');
    const activityIdParam = c.req.query('activityId');

    if (!startDateParam || !endDateParam) {
      return c.json({
        success: false,
        error: 'startDate and endDate are required',
      }, 400);
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return c.json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD',
      }, 400);
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // Build where clause
    const whereClause: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (activityIdParam) {
      whereClause.activityId = Number(activityIdParam);
    }

    // Get activity sessions in the date range
    const sessions = await prisma.activitysession.findMany({
      where: whereClause,
      include: {
        afterschoolactivity: true,
        attendance: {
          include: {
            user: {
              select: {
                id: true,
                rfid: true,
                fname: true,
                mname: true,
                lname: true,
                email: true,
                grade: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Transform the data
    const attendanceRecords = sessions.flatMap(session =>
      session.attendance.map(record => ({
        date: session.date.toISOString().split('T')[0],
        activityName: session.afterschoolactivity.name,
        activityDay: session.afterschoolactivity.dayOfWeek,
        studentId: record.user.id,
        studentName: `${record.user.fname} ${record.user.mname || ''} ${record.user.lname}`.replace(/\s+/g, ' ').trim(),
        rfid: record.user.rfid?.toString() || '',
        grade: record.user.grade,
        status: record.status,
        processedBy: record.processedBy,
        markedAt: record.createdAt,
      }))
    );

    // Calculate summary statistics
    const summary = {
      totalSessions: sessions.length,
      totalAttendanceRecords: attendanceRecords.length,
      presentCount: attendanceRecords.filter(r => r.status === 'present').length,
      absentCount: attendanceRecords.filter(r => r.status === 'absent').length,
      dateRange: {
        start: startDateParam,
        end: endDateParam,
      },
    };

    return c.json({
      success: true,
      data: {
        records: attendanceRecords,
        summary,
      },
    });
  } catch (error) {
    console.error('[ERROR] Error fetching attendance by date range:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};