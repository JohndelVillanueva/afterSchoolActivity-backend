import { type Context } from 'hono';
import { PrismaClient } from '@prisma/client';
import { sign } from 'hono/jwt'
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const JWT_EXPIRATION = '7d'; // Token expires in 7 days

export const getAllUsersController = async (c: Context): Promise<Response> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        rfid: true,
        fname: true,
        mname: true,
        lname: true,
        position: true,
        email: true,
        isEnrolledInAfterSchool: true,
        usersession: {
          select: {
            id: true,
            activityId: true,
            sessionsPurchased: true,
            sessionsAttended: true,
            sessionsRemaining: true,
            // Include activity details for each session
            afterschoolactivity: {
              select: {
                id: true,
                name: true,
                dayOfWeek: true,
                startTime: true,
              }
            }
          }
        }
      },
    });

    // Convert BigInt rfid to string and include all sessions with activity details
    const usersWithStringRfid = users.map(user => {
      // Calculate totals across all sessions
      const totalSessionsPurchased = user.usersession.reduce((sum, session) => sum + session.sessionsPurchased, 0);
      const totalSessionsAttended = user.usersession.reduce((sum, session) => sum + session.sessionsAttended, 0);
      const totalSessionsRemaining = user.usersession.reduce((sum, session) => sum + session.sessionsRemaining, 0);

      // Format individual sessions with activity details
      const formattedSessions = user.usersession.map(session => ({
        id: session.id,
        activityId: session.activityId,
        activityName: session.afterschoolactivity?.name || 'Unknown Activity',
        dayOfWeek: session.afterschoolactivity?.dayOfWeek || '',
        startTime: session.afterschoolactivity?.startTime || '',
        sessionsPurchased: session.sessionsPurchased,
        sessionsAttended: session.sessionsAttended,
        sessionsRemaining: session.sessionsRemaining,
      }));

      return {
        ...user,
        rfid: user.rfid?.toString(),
        // Totals for overview/progress bar
        sessionsPurchased: totalSessionsPurchased,
        sessionsAttended: totalSessionsAttended,
        sessionsRemaining: totalSessionsRemaining,
        // Individual sessions array for detailed display
        sessions: formattedSessions,
        // Count of sessions/activities
        sessionCount: formattedSessions.length,
      };
    });

    return c.json({
      success: true,
      data: usersWithStringRfid,
    });
  } catch (error) {
    console.error('[ERROR] Error fetching users:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

export const createCoachController = async (c: Context): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { fname, lname, email, rfid, gender = '', mobile = '', activityId } = body;
    
    console.log('[DEBUG] Create coach request body:', body);
    
    // Validate required fields
    if (!fname || !lname || !email || !rfid || !activityId) {
      console.log('[ERROR] Missing required fields:', { fname, lname, email, rfid, activityId });
      return c.json({ 
        success: false, 
        error: 'Missing required fields: first name, last name, email, RFID, and activity' 
      }, 400);
    }
    
    // Validate RFID format
    if (!rfid.match(/^\d+$/)) {
      return c.json({ 
        success: false, 
        error: 'RFID must contain only numbers' 
      }, 400);
    }
    
    // Convert RFID to BigInt
    const rfidBigInt = BigInt(rfid);
    
    // ============================================
    // CHECK 1: Check if RFID exists in database
    // ============================================
    const existingUserByRfid = await prisma.user.findFirst({
      where: { rfid: rfidBigInt }
    });
    
    console.log('[DEBUG] RFID check result:', {
      rfid: rfid,
      exists: !!existingUserByRfid,
      userId: existingUserByRfid?.id,
      type: existingUserByRfid?.type
    });
    
    if (existingUserByRfid) {
      // RFID exists in database
      const existingName = `${existingUserByRfid.fname} ${existingUserByRfid.lname}`;
      const existingType = existingUserByRfid.type || existingUserByRfid.position || 'user';
      
      // Check if already a coach
      if (existingUserByRfid.type === 'coach') {
        return c.json({ 
          success: false, 
          error: `RFID ${rfid} already assigned to coach ${existingName}`,
          details: {
            existingUser: {
              id: existingUserByRfid.id,
              name: existingName,
              type: existingType,
              email: existingUserByRfid.email,
              rfid: existingUserByRfid.rfid?.toString(),
              coachedActivityId: existingUserByRfid.coachedActivityId
            }
          },
          userExists: true
        }, 409);
      }
      
      // If not a coach, we'll convert this user to coach
      console.log(`[DEBUG] RFID ${rfid} exists for ${existingType} ${existingName}, will convert to coach`);
    }
    
    // ============================================
    // CHECK 2: Check if email exists for coaches
    // ============================================
    const existingCoachByEmail = await prisma.user.findFirst({
      where: {
        email: email,
        type: 'coach'
      }
    });
    
    if (existingCoachByEmail) {
      return c.json({ 
        success: false, 
        error: 'A coach with this email already exists',
        details: {
          existingCoach: {
            name: `${existingCoachByEmail.fname} ${existingCoachByEmail.lname}`,
            email: existingCoachByEmail.email,
            rfid: existingCoachByEmail?.rfid?.toString()
          }
        }
      }, 409);
    }
    
    // Verify activity exists
    const activity = await prisma.afterschoolactivity.findUnique({
      where: { id: Number(activityId) }
    });
    
    if (!activity) {
      return c.json({ 
        success: false, 
        error: 'Selected activity does not exist' 
      }, 400);
    }
    
    // Check how many coaches are already assigned to this activity
    const existingCoachesCount = await prisma.user.count({
      where: {
        type: 'coach',
        coachedActivity: {
          id: Number(activityId)
        }
      }
    });
    
    console.log(`[DEBUG] Activity ${activityId} already has ${existingCoachesCount} coaches`);
    
    // LIMIT: Only 3 coaches per activity
    const MAX_COACHES_PER_ACTIVITY = 3;
    if (existingCoachesCount >= MAX_COACHES_PER_ACTIVITY) {
      const existingCoaches = await prisma.user.findMany({
        where: {
          type: 'coach',
          coachedActivity: {
            id: Number(activityId)
          }
        },
        select: {
          fname: true,
          lname: true,
          email: true
        },
        take: 3
      });
      
      const coachNames = existingCoaches.map(coach => `${coach.fname} ${coach.lname}`).join(', ');
      
      return c.json({ 
        success: false, 
        error: `This activity already has ${MAX_COACHES_PER_ACTIVITY} coaches assigned. Maximum of ${MAX_COACHES_PER_ACTIVITY} coaches allowed per activity.`,
        details: {
          activityId: activityId,
          activityName: activity.name,
          currentCoachesCount: existingCoachesCount,
          maxCoachesAllowed: MAX_COACHES_PER_ACTIVITY,
          existingCoaches: coachNames,
          suggestion: 'Please select a different activity or remove an existing coach first.'
        }
      }, 400);
    }
    
    let coach;
    let isExistingUserConverted = false;
    
    if (existingUserByRfid) {
      // ============================================
      // CASE 1: RFID exists - Convert user to coach
      // ============================================
      console.log('[DEBUG] Converting existing user to coach:', existingUserByRfid.id);
      
      // If it's a student, remove their enrollments first
      if (existingUserByRfid.type === 'student') {
        console.log('[DEBUG] Removing student enrollments...');
        await prisma.enrolledactivity.deleteMany({
          where: { userId: existingUserByRfid.id }
        });
        await prisma.usersession.deleteMany({
          where: { userId: existingUserByRfid.id }
        });
      }
      
      // Convert existing user to coach
      coach = await prisma.user.update({
        where: { id: existingUserByRfid.id },
        data: {
          type: 'coach',
          position: 'coach',
          fname: fname.trim(),
          lname: lname.trim(),
          email: email.trim(),
          gender: gender || existingUserByRfid.gender,
          mobile: mobile?.trim() || existingUserByRfid.mobile,
          isEnrolledInAfterSchool: 2, // Set to coach status
          coachedActivity: {
            connect: { id: Number(activityId) }
          },
          // Clear student-specific fields
          grade: '',
          section: '',
          // REMOVED: updatedAt: new Date(), // User model doesn't have updatedAt field
        }
      });
      
      isExistingUserConverted = true;
      console.log('[DEBUG] User converted to coach:', coach.id);
      
    } else {
      // ============================================
      // CASE 2: RFID doesn't exist - Create new coach
      // ============================================
      console.log('[DEBUG] Creating new coach with RFID:', rfid);
      
      coach = await prisma.user.create({
        data: {
          rfid: rfidBigInt,
          fname: fname.trim(),
          mname: '',
          lname: lname.trim(),
          type: 'coach',
          gender: gender || '',
          position: 'coach',
          grade: '',
          section: '',
          dob: null,
          email: email.trim(),
          mobile: mobile?.trim() || '',
          vacchist: '',
          photo: '',
          manager: '',
          isactive: 1,
          is_situation: '',
          username: email.trim(),
          password: '',
          level: 1,
          status: 1,
          prevsch: '',
          prevschcountry: '',
          lrn: '',
          uniqid: '',
          tf: '',
          country: '',
          nationality: '',
          nationalities: '',
          guardianname: '',
          guardianemail: '',
          guardianphone: '',
          referral: '',
          apptype: '',
          sy: '',
          strand: '',
          religion: '',
          visa: '',
          earlybird: 0,
          modelrelease: 0,
          feepolicy: 0,
          refund: 0,
          tos: 0,
          empno: '',
          isESL: 0,
          house: '',
          isofficial: 0,
          isEnrolledInAfterSchool: 2,
          coachedActivity: {
            connect: { id: Number(activityId) }
          },
        }
      });
      
      console.log('[DEBUG] New coach created:', coach.id);
    }
    
    // Update activity coachName if this is the first coach
    const currentCoachesCount = await prisma.user.count({
      where: {
        type: 'coach',
        coachedActivity: {
          id: Number(activityId)
        }
      }
    });
    
    if (currentCoachesCount === 1) {
      await prisma.afterschoolactivity.update({
        where: { id: Number(activityId) },
        data: {
          coachName: `${fname} ${lname}`,
        }
      });
      console.log('[DEBUG] Updated activity coachName');
    }
    
    // Convert BigInt to string before returning
    const coachWithStringRfid = {
      ...coach,
      rfid: coach.rfid?.toString(),
      assignedActivity: activity.name,
      assignedActivityId: activity.id,
      coachNumber: currentCoachesCount,
      isExistingUserConverted,
      previousType: isExistingUserConverted ? existingUserByRfid?.type : null,
    };
    
    return c.json({ 
      success: true, 
      data: coachWithStringRfid,
      message: isExistingUserConverted 
        ? `User ${existingUserByRfid?.fname} ${existingUserByRfid?.lname} (RFID: ${rfid}) converted to coach and assigned to ${activity.name}`
        : `Coach ${fname} ${lname} created successfully with RFID ${rfid} and assigned to ${activity.name}`
    }, 201);
    
  } catch (error) {
    console.error('[ERROR] Error creating coach:', error);
    
    let errorMessage = 'Internal server error';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      if (error.message.includes('Unique constraint') || error.code === 'P2002') {
        errorMessage = 'RFID already exists in the system.';
      } else if (error.message.includes('Foreign key constraint')) {
        errorMessage = 'Invalid activity ID or activity does not exist';
      }
    }
    
    return c.json({ 
      success: false, 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : undefined : undefined
    }, 500);
  }
};

export const getAllStudentsController = async (c: Context): Promise<Response> => {
  try {
    const students = await prisma.user.findMany({
      where: {
        type: 'student',
        isEnrolledInAfterSchool: 1, // Changed from true to 1
      },
      select: {
        id: true,
        rfid: true,
        fname: true,
        mname: true,
        lname: true,
        email: true,
        mobile: true,
        gender: true,
        grade: true,
        section: true,
        type: true,
        position: true,
        isEnrolledInAfterSchool: true,
        dob: true,
        photo: true,
      },
      orderBy: [
        { fname: 'asc' },
        { lname: 'asc' }
      ]
    });

    const result = students.map(student => ({
      ...student,
      rfid: student.rfid?.toString(),
      fullName: `${student.fname} ${student.mname ? student.mname + ' ' : ''}${student.lname}`.trim(),
    }));

    return c.json({ 
      success: true, 
      data: result,
      count: result.length
    });
    
  } catch (error) {
    console.error('[ERROR] Error fetching students:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

export const getAllCoachesController = async (c: Context): Promise<Response> => {
  try {
    // Get coaches with their coached activity
    const coaches = await prisma.user.findMany({
      where: {
        type: 'coach' // OR you can use: isEnrolledInAfterSchool: 2
      },
      include: {
        coachedActivity: {
          select: {
            id: true,
            name: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            location: true,
            coachName: true,
            description: true,
            photo: true,
            rate: true,
          }
        }
      },
      orderBy: {
        fname: 'asc'
      }
    });

    // Format the response
    const formattedCoaches = coaches.map(coach => {
      // Get the full name
      const fullName = `${coach.fname} ${coach.mname ? coach.mname + ' ' : ''}${coach.lname}`.trim();
      
      // Format the coach data
      const formattedCoach: any = {
        id: coach.id,
        rfid: coach.rfid?.toString(),
        fname: coach.fname,
        mname: coach.mname,
        lname: coach.lname,
        fullName: fullName,
        email: coach.email,
        gender: coach.gender,
        mobile: coach.mobile,
        type: coach.type,
        position: coach.position,
        grade: coach.grade,
        section: coach.section,
        isEnrolledInAfterSchool: coach.isEnrolledInAfterSchool,
        // Include activity if available
        activities: coach.coachedActivity ? [{
          id: coach.coachedActivity.id,
          name: coach.coachedActivity.name,
          dayOfWeek: coach.coachedActivity.dayOfWeek,
          startTime: coach.coachedActivity.startTime,
          endTime: coach.coachedActivity.endTime,
          location: coach.coachedActivity.location,
          coachName: coach.coachedActivity.coachName,
          description: coach.coachedActivity.description,
          photo: coach.coachedActivity.photo,
          rate: coach.coachedActivity.rate,
        }] : []
      };

      return formattedCoach;
    });

    return c.json({ 
      success: true, 
      data: formattedCoaches,
      count: formattedCoaches.length,
      message: `Found ${formattedCoaches.length} coach${formattedCoaches.length !== 1 ? 'es' : ''}`
    });
    
  } catch (error) {
    console.error('[ERROR] Error fetching coaches:', error);
    
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.stack : undefined) : undefined
    }, 500);
  }
};

export const createUserController = async (c: Context): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { rfid, activityId, sessionDate } = body;

    if (!rfid || !activityId) {
      return c.json({
        success: false,
        error: 'Missing required fields',
      }, 400);
    }

    // Find the user by RFID
    const user = await prisma.user.findFirst({ where: { rfid: BigInt(rfid) } });
    if (!user) {
      return c.json({
        success: false,
        error: 'User not found',
      }, 404);
    }

    // --- FIX START: Check for existing enrollment to prevent Unique Constraint failure (500 error) ---
    let enrollment = await prisma.enrolledactivity.findUnique({
      where: {
        userId_activityId: {
          userId: user.id,
          activityId: Number(activityId),
        }
      },
    });

    // Only create the enrollment record if it does not already exist
    if (!enrollment) {
      enrollment = await prisma.enrolledactivity.create({
        data: {
          userId: user.id,
          activityId: Number(activityId),
        },
      });
    }
    // --- FIX END ---

    // Update user enrollment status
    await prisma.user.update({
      where: { id: user.id },
      data: { isEnrolledInAfterSchool: 1 },
    });

    // Create or find today's activity session
    const sessionDateToUse = sessionDate ? new Date(sessionDate) : new Date();
    sessionDateToUse.setHours(0, 0, 0, 0); // Normalize to start of day

    let activitySession = await prisma.activitysession.findFirst({
      where: {
        activityId: Number(activityId),
        date: sessionDateToUse,
      },
    });

    // If no session exists for this date, create one
    if (!activitySession) {
      activitySession = await prisma.activitysession.create({
        data: {
          activityId: Number(activityId),
          date: sessionDateToUse,
          updatedAt: new Date(),
        },
      });
    }

    // Optionally, create an attendance record for this session
    await prisma.attendance.create({
      data: {
        sessionId: activitySession.id,
        userId: user.id,
        status: 'enrolled', // or 'pending'
      },
    });

    return c.json({
      success: true,
      data: {
        enrollment,
        session: activitySession,
      },
    }, 201);
  } catch (error) {
    console.error('[ERROR] Error registering student:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

export const createStudentController = async (c: Context): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { 
        fname, 
        lname, 
        email, 
        rfid, 
        gender = '', 
        mobile = '',
        activityId,
        sessionDate,
        sessionsPurchased = 0
    } = body;
    
    console.log('[DEBUG] Create student request:', { fname, lname, rfid, activityId, sessionsPurchased });
    
    if (!fname || !lname || !rfid) {
      return c.json({ success: false, error: 'Missing required fields: first name, last name, and RFID' }, 400);
    }
    
    // Check if user with same RFID exists
    const existing = await prisma.user.findFirst({
      where: { rfid: BigInt(rfid) }
    });
    
    if (existing) {
      console.log('[DEBUG] Student with RFID already exists:', existing.id);

      if (!activityId) {
        return c.json({
          success: false,
          error: `${existing.fname} ${existing.lname} (RFID: ${rfid}) already exists. Select an activity to enroll this student.`,
          details: {
            existingStudent: {
              id: existing.id,
              name: `${existing.fname} ${existing.lname}`,
              email: existing.email || 'No email',
              isEnrolledInAfterSchool: existing.isEnrolledInAfterSchool
            }
          },
          userExists: true
        }, 409);
      }

      console.log('[DEBUG] Enrolling existing student in selected activity');

      await prisma.user.update({
        where: { id: existing.id },
        data: { isEnrolledInAfterSchool: 1 },
      });

      let enrollment = await prisma.enrolledactivity.findUnique({
        where: {
          userId_activityId: {
            userId: existing.id,
            activityId: Number(activityId),
          }
        },
      });

      if (!enrollment) {
        enrollment = await prisma.enrolledactivity.create({
          data: {
            userId: existing.id,
            activityId: Number(activityId),
          },
        });
        console.log('[DEBUG] Enrollment created:', enrollment.id);
      } else {
        console.log('[DEBUG] Enrollment already exists:', enrollment.id);
      }

      const sessionDateToUse = sessionDate ? new Date(sessionDate) : new Date();
      sessionDateToUse.setHours(0, 0, 0, 0);

      let activitySession = await prisma.activitysession.findFirst({
        where: {
          activityId: Number(activityId),
          date: sessionDateToUse,
        },
      });

      if (!activitySession) {
        activitySession = await prisma.activitysession.create({
          data: {
            activityId: Number(activityId),
            date: sessionDateToUse,
            updatedAt: new Date(),
          },
        });
        console.log('[DEBUG] Activity session created:', activitySession.id);
      } else {
        console.log('[DEBUG] Activity session found:', activitySession.id);
      }

      let userSession = await prisma.usersession.findUnique({
        where: {
          userId_activityId: {
            userId: existing.id,
            activityId: Number(activityId),
          }
        }
      });

      if (!userSession) {
        userSession = await prisma.usersession.create({
          data: {
            userId: existing.id,
            activityId: Number(activityId),
            sessionId: activitySession.id,
            sessionsPurchased: Number(sessionsPurchased),
            sessionsAttended: 0,
            sessionsRemaining: Number(sessionsPurchased),
          },
        });
        console.log('[DEBUG] User session created:', userSession.id);
      } else {
        userSession = await prisma.usersession.update({
          where: { id: userSession.id },
          data: {
            sessionsPurchased: Number(sessionsPurchased),
            sessionsRemaining: Number(sessionsPurchased) - userSession.sessionsAttended,
            updatedAt: new Date(),
          },
        });
        console.log('[DEBUG] User session updated:', userSession.id);
      }

      const studentWithStringRfid = {
        ...existing,
        rfid: existing.rfid?.toString(),
        isEnrolledInAfterSchool: 1,
      };

      return c.json({
        success: true,
        data: studentWithStringRfid,
        enrollment,
        session: activitySession,
        userSession,
        userExists: true,
        message: 'Existing student enrolled in selected activity successfully'
      }, 200);
    }
    
    // Create new student
    const student = await prisma.user.create({
      data: {
        rfid: BigInt(rfid),
        fname,
        mname: '',
        lname,
        type: 'student', 
        gender,
        position: 'student',
        isactive: 1,
        isEnrolledInAfterSchool: activityId ? 1 : 0, // Students = 1, not enrolled = 0
        grade: '', 
        section: '', 
        dob: null, 
        email: email || '',
        mobile, 
        vacchist: '', 
        photo: '', 
        manager: '', 
        is_situation: '',
        username: email || rfid,
        password: '', 
        level: 1, 
        status: 1, 
        prevsch: '', 
        prevschcountry: '', 
        lrn: '', 
        uniqid: '', 
        tf: '', 
        country: '',
        nationality: '', 
        nationalities: '', 
        guardianname: '', 
        guardianemail: '', 
        guardianphone: '', 
        referral: '',
        apptype: '', 
        sy: '', 
        strand: '', 
        religion: '', 
        visa: '', 
        earlybird: 0, 
        modelrelease: 0, 
        feepolicy: 0, 
        refund: 0, 
        tos: 0, 
        empno: '', 
        isESL: 0, 
        house: '', 
        isofficial: 0,
      }
    });
    
    console.log('[DEBUG] Student created:', student.id);
    
    let enrollment = null;
    let activitySession = null;
    let userSession = null;
    
    if (activityId) {
      console.log('[DEBUG] Enrolling student in activity:', activityId);
      
      enrollment = await prisma.enrolledactivity.create({
        data: {
          userId: student.id,
          activityId: Number(activityId),
        },
      });
      
      const sessionDateToUse = sessionDate ? new Date(sessionDate) : new Date();
      sessionDateToUse.setHours(0, 0, 0, 0);

      activitySession = await prisma.activitysession.findFirst({
        where: {
          activityId: Number(activityId),
          date: sessionDateToUse,
        },
      });

      if (!activitySession) {
        activitySession = await prisma.activitysession.create({
          data: {
            activityId: Number(activityId),
            date: sessionDateToUse,
            updatedAt: new Date(),
          },
        });
      }
      
      // Create user session for new student
      userSession = await prisma.usersession.create({
        data: {
          userId: student.id,
          activityId: Number(activityId),
          sessionId: activitySession.id,
          sessionsPurchased: Number(sessionsPurchased),
          sessionsAttended: 0,
          sessionsRemaining: Number(sessionsPurchased),
        },
      });
      console.log('[DEBUG] User session created for new student:', userSession.id);
    }
    
    const studentWithStringRfid = {
      ...student,
      rfid: student.rfid?.toString(),
    };
    
    return c.json({ 
      success: true, 
      data: studentWithStringRfid,
      enrollment,
      session: activitySession,
      userSession,
      userExists: false,
      message: 'Student created and enrolled successfully'
    }, 201);
  } catch (error) {
    console.error('[ERROR] Error creating student:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, 500);
  }
};

export const getStudentsByActivityController = async (c: Context): Promise<Response> => {
  try {
    const activityId = c.req.param('activityId');
    if (!activityId) {
      return c.json({ success: false, error: 'Missing activity ID' }, 400);
    }
    
    const id = Number(activityId);
    if (isNaN(id)) {
      return c.json({ success: false, error: 'Invalid activity ID format' }, 400);
    }

    // Verify the activity exists first
    const activity = await prisma.afterschoolactivity.findUnique({
      where: { id: id },
      select: { id: true, name: true }
    });

    if (!activity) {
      return c.json({ 
        success: false, 
        error: 'Activity not found' 
      }, 404);
    }

    // Get enrolled students with their user sessions and attendance info
    const enrolledStudents = await prisma.enrolledactivity.findMany({
      where: { 
        activityId: id,
        user: {
          type: 'student',
          isEnrolledInAfterSchool: 1, // Students = 1
        }
      },
      include: {
        user: {
          select: {
            id: true,
            rfid: true,
            fname: true,
            mname: true,
            lname: true,
            email: true,
            mobile: true,
            grade: true,
            section: true,
            isEnrolledInAfterSchool: true,
          }
        },
      },
      orderBy: {
        user: {
          fname: 'asc',
        }
      }
    });

    if (enrolledStudents.length === 0) {
      return c.json({ 
        success: true, 
        data: [],
        activity: activity.name,
        message: 'No students enrolled in this activity' 
      });
    }

    // Get user sessions for each student
    const userIds = enrolledStudents.map(record => record.userId);
    
    const userSessions = await prisma.usersession.findMany({
      where: {
        userId: { in: userIds },
        activityId: id,
      },
      select: {
        userId: true,
        sessionsPurchased: true,
        sessionsAttended: true,
        sessionsRemaining: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    // Create a map of user sessions by userId for quick lookup
    const sessionsMap = new Map();
    userSessions.forEach(session => {
      sessionsMap.set(session.userId, session);
    });

    // Format the result with additional info
    const result = enrolledStudents.map(record => {
      const userSession = sessionsMap.get(record.userId);
      
      return {
        id: record.user.id,
        rfid: record.user.rfid?.toString(),
        fname: record.user.fname,
        mname: record.user.mname,
        lname: record.user.lname,
        fullName: `${record.user.fname} ${record.user.mname ? record.user.mname + ' ' : ''}${record.user.lname}`.trim(),
        email: record.user.email,
        mobile: record.user.mobile,
        grade: record.user.grade,
        section: record.user.section,
        isEnrolledInAfterSchool: record.user.isEnrolledInAfterSchool,
        enrollmentDate: record.enrollmentDate,
        // Session information
        sessionsPurchased: userSession?.sessionsPurchased || 0,
        sessionsAttended: userSession?.sessionsAttended || 0,
        sessionsRemaining: userSession?.sessionsRemaining || 0,
        attendanceRate: userSession?.sessionsPurchased 
          ? Math.round((userSession.sessionsAttended / userSession.sessionsPurchased) * 100) 
          : 0,
        lastUpdated: userSession?.updatedAt || null,
      };
    });

    return c.json({ 
      success: true, 
      data: result,
      activity: {
        id: activity.id,
        name: activity.name,
      },
      summary: {
        totalStudents: result.length,
        totalSessionsPurchased: result.reduce((sum, student) => sum + (student.sessionsPurchased || 0), 0),
        totalSessionsAttended: result.reduce((sum, student) => sum + (student.sessionsAttended || 0), 0),
        averageAttendanceRate: result.length > 0 
          ? Math.round(result.reduce((sum, student) => sum + student.attendanceRate, 0) / result.length)
          : 0,
      }
    });
  } catch (error) {
    console.error('[ERROR] Error fetching students by activity:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, 500);
  }
};

export const enrollStudentInActivityController = async (c: Context): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { rfid, activityId, sessionDate } = body;

    if (!rfid || !activityId) {
      return c.json({
        success: false,
        error: 'Missing required fields: rfid and activityId',
      }, 400);
    }

    // Find the user by RFID
    const user = await prisma.user.findFirst({ where: { rfid: BigInt(rfid) } });
    if (!user) {
      return c.json({
        success: false,
        error: 'User not found',
      }, 404);
    }

    // Check for existing enrollment
    let enrollment = await prisma.enrolledactivity.findUnique({
      where: {
        userId_activityId: {
          userId: user.id,
          activityId: Number(activityId),
        }
      },
    });

    // Create enrollment if it doesn't exist
    if (!enrollment) {
      enrollment = await prisma.enrolledactivity.create({
        data: {
          userId: user.id,
          activityId: Number(activityId),
        },
      });
    }

    // Update user enrollment status
    await prisma.user.update({
      where: { id: user.id },
      data: { isEnrolledInAfterSchool: 1 },
    });

    // Create or find activity session
    const sessionDateToUse = sessionDate ? new Date(sessionDate) : new Date();
    sessionDateToUse.setHours(0, 0, 0, 0);

    let activitySession = await prisma.activitysession.findFirst({
      where: {
        activityId: Number(activityId),
        date: sessionDateToUse,
      },
    });

    if (!activitySession) {
      activitySession = await prisma.activitysession.create({
        data: {
          activityId: Number(activityId),
          date: sessionDateToUse,
          updatedAt: new Date(),
        },
      });
    }

    // Create attendance record if it doesn't exist
    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        sessionId_userId: {
          sessionId: activitySession.id,
          userId: user.id,
        }
      }
    });

    if (!existingAttendance) {
      await prisma.attendance.create({
        data: {
          sessionId: activitySession.id,
          userId: user.id,
          status: 'enrolled',
        },
      });
    }

    return c.json({
      success: true,
      data: {
        enrollment,
        session: activitySession,
      },
    }, 200);
  } catch (error) {
    console.error('[ERROR] Error enrolling student:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

export const getUserSessionsController = async (c: Context): Promise<Response> => {
  try {
    const userId = c.req.param('userId');
    
    if (!userId) {
      return c.json({ success: false, error: 'Missing user ID' }, 400);
    }
    
    const sessions = await prisma.usersession.findMany({
      where: { userId: Number(userId) },
      include: {
        afterschoolactivity: {
          select: {
            id: true,
            name: true,
            description: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          }
        },
        activitysession: {
          select: {
            id: true,
            date: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return c.json({ success: true, data: sessions });
  } catch (error) {
    console.error('[ERROR] Error fetching user sessions:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

export const getUserSessionsByRfidController = async (c: Context): Promise<Response> => {
  try {
    const rfid = c.req.param('rfid');
    
    if (!rfid) {
      return c.json({ success: false, error: 'Missing RFID' }, 400);
    }
    
    const user = await prisma.user.findFirst({
      where: { rfid: BigInt(rfid) }
    });
    
    if (!user) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }
    
    const sessions = await prisma.usersession.findMany({
      where: { userId: user.id },
      include: {
        afterschoolactivity: {
          select: {
            id: true,
            name: true,
            description: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          }
        },
        activitysession: {
          select: {
            id: true,
            date: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return c.json({ 
      success: true, 
      data: {
        user: {
          id: user.id,
          name: `${user.fname} ${user.lname}`,
          rfid: user.rfid?.toString(),
        },
        sessions
      }
    });
  } catch (error) {
    console.error('[ERROR] Error fetching user sessions by RFID:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

export const loginController = async (c: Context): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    console.log('[DEBUG] Login attempt for:', email);

    // Validate input
    if (!email || !password) {
      return c.json({
        success: false,
        error: 'Email/Username and password are required',
      }, 400);
    }

    const trimmedEmail = email.toLowerCase().trim();

    // Find user by email OR username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: trimmedEmail },
          { username: trimmedEmail },
        ],
        isactive: 1, // Only allow active users to login
      },
      select: {
        id: true,
        rfid: true,
        fname: true,
        mname: true,
        lname: true,
        email: true,
        username: true,
        password: true,
        position: true,
        type: true,
        isEnrolledInAfterSchool: true,
        photo: true,
        grade: true,
        section: true,
      },
    });

    // User not found
    if (!user) {
      console.log('[DEBUG] User not found:', email);
      return c.json({
        success: false,
        error: 'Invalid email/username or password',
      }, 401);
    }

    // Verify password
    let isPasswordValid = false;
    
    if (!user.password) {
      console.log('[DEBUG] User has no password set');
      return c.json({
        success: false,
        error: 'Invalid email/username or password',
      }, 401);
    }

    // Check if password is bcrypt hashed (starts with $2a$, $2b$, $2y$, or $2x$)
    if (user.password.match(/^\$2[abxy]\$/) || user.password.startsWith('$2b$')) {
      console.log('[DEBUG] Comparing bcrypt hashed password');
      console.log('[DEBUG] Hash type:', user.password.substring(0, 4));
      
      try {
        // PHP uses $2y$, Node.js bcrypt uses $2a$ or $2b$
        // Convert $2y$ to $2a$ for compatibility
        let hashToCompare = user.password;
        if (user.password.startsWith('$2y$')) {
          hashToCompare = '$2a$' + user.password.substring(4);
          console.log('[DEBUG] Converted $2y$ hash to $2a$ for compatibility');
        }
        
        isPasswordValid = await bcrypt.compare(password, hashToCompare);
        console.log('[DEBUG] Bcrypt compare result:', isPasswordValid);
      } catch (error) {
        console.error('[ERROR] Bcrypt comparison failed:', error);
        isPasswordValid = false;
      }
    } else {
      // Fallback for plain text passwords
      console.log('[DEBUG] Comparing plain text password');
      isPasswordValid = password === user.password;
    }

    if (!isPasswordValid) {
      console.log('[DEBUG] Invalid password for user:', email);
      return c.json({
        success: false,
        error: 'Invalid email/username or password',
      }, 401);
    }

    // Generate JWT token
    const payload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      position: user.position,
      type: user.type,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7), // 7 days
    };

    const token = await sign(payload, JWT_SECRET);

    // Prepare user data (exclude sensitive information)
    const userData = {
      id: user.id,
      rfid: user.rfid?.toString(),
      firstName: user.fname,
      middleName: user.mname,
      lastName: user.lname,
      fullName: `${user.fname} ${user.mname ? user.mname + ' ' : ''}${user.lname}`.trim(),
      email: user.email,
      username: user.username,
      position: user.position,
      type: user.type,
      isEnrolledInAfterSchool: user.isEnrolledInAfterSchool,
      photo: user.photo,
      grade: user.grade,
      section: user.section,
    };

    console.log('[DEBUG] Login successful for user:', user.id);

    return c.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userData,
        token: token,
      },
    }, 200);

  } catch (error) {
    console.error('[ERROR] Login error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

export const verifyTokenMiddleware = async (c: Context, next: Function) => {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        success: false,
        error: 'No token provided',
      }, 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify token (you'll need to import verify from hono/jwt)
    // const payload = await verify(token, JWT_SECRET);
    
    // Attach user info to context for use in subsequent handlers
    // c.set('user', payload);
    
    await next();
  } catch (error) {
    console.error('[ERROR] Token verification failed:', error);
    return c.json({
      success: false,
      error: 'Invalid or expired token',
    }, 401);
  }
};

export const getCurrentUserController = async (c: Context): Promise<Response> => {
  try {
    // Get user ID from verified token (set by middleware)
    const userId = c.get('user')?.userId;
    
    if (!userId) {
      return c.json({
        success: false,
        error: 'User not authenticated',
      }, 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        rfid: true,
        fname: true,
        mname: true,
        lname: true,
        email: true,
        username: true,
        position: true,
        type: true,
        isEnrolledInAfterSchool: true,
        photo: true,
        grade: true,
        section: true,
      },
    });

    if (!user) {
      return c.json({
        success: false,
        error: 'User not found',
      }, 404);
    }

    const userData = {
      id: user.id,
      rfid: user.rfid?.toString(),
      firstName: user.fname,
      middleName: user.mname,
      lastName: user.lname,
      fullName: `${user.fname} ${user.mname ? user.mname + ' ' : ''}${user.lname}`.trim(),
      email: user.email,
      username: user.username,
      position: user.position,
      type: user.type,
      isEnrolledInAfterSchool: user.isEnrolledInAfterSchool,
      photo: user.photo,
      grade: user.grade,
      section: user.section,
    };

    return c.json({
      success: true,
      data: userData,
    }, 200);

  } catch (error) {
    console.error('[ERROR] Error fetching current user:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

export const logoutController = async (c: Context): Promise<Response> => {
  try {
    // In a stateless JWT setup, logout is typically handled client-side
    // by removing the token from storage
    // 
    // If you want server-side logout, you'd need to implement token blacklisting
    // using Redis or a database table to store invalidated tokens

    return c.json({
      success: true,
      message: 'Logout successful',
    }, 200);

  } catch (error) {
    console.error('[ERROR] Logout error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

export const getStudentDetailsController = async (c: Context): Promise<Response> => {
  try {
    const studentId = c.req.param('id');
    
    console.log(`[DEBUG] Fetching student details for ID: ${studentId}`);
    
    if (!studentId) {
      return c.json({ 
        success: false, 
        error: 'Student ID is required' 
      }, 400);
    }
    
    const id = Number(studentId);
    if (isNaN(id)) {
      return c.json({ 
        success: false, 
        error: 'Invalid student ID format' 
      }, 400);
    }

    // Fetch student with only the specific fields needed
    const student = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        rfid: true,
        fname: true,
        lname: true,
        email: true,
        username: true,
        // Guardian information
        guardianname: true,
        guardianemail: true,
        guardianphone: true,
        // Additional basic info
        grade: true,
        dob: true,
        vacchist: true,
        isEnrolledInAfterSchool: true,
        // NOTE: createdAt and updatedAt don't exist in user model!
        // Enrolled activities with activity details
        enrolledactivity: {
          select: {
            id: true,
            enrollmentDate: true,
            afterschoolactivity: {
              select: {
                id: true,
                name: true,
                description: true,
                dayOfWeek: true,
                startTime: true,
                endTime: true,
                location: true,
                coachName: true,
                rate: true,
              }
            }
          }
        },
        // User sessions information
        usersession: {
          select: {
            id: true,
            activityId: true,
            sessionId: true,
            sessionsPurchased: true,
            sessionsAttended: true,
            sessionsRemaining: true,
            createdAt: true,
            updatedAt: true,
            afterschoolactivity: {
              select: {
                name: true,
                dayOfWeek: true,
                startTime: true,
              }
            }
          }
        },
        // Attendance history
        attendance: {
          select: {
            id: true,
            sessionId: true,
            status: true,
            createdAt: true,
            activitysession: {
              select: {
                date: true,
                afterschoolactivity: {
                  select: {
                    name: true
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    console.log(`[DEBUG] Student found: ${student ? 'Yes' : 'No'}`);

    if (!student) {
      return c.json({ 
        success: false, 
        error: 'Student not found' 
      }, 404);
    }

    // Get the latest usersession to use its timestamps
    const latestSession = student.usersession?.[0];
    
    // Format the response to match the frontend interface
    const formattedStudent = {
      id: student.id,
      rfid: student.rfid?.toString() || '',
      fname: student.fname || '',
      lname: student.lname || '',
      email: student.email || '',
      username: student.username || '',
      grade: student.grade || '',
      parentName: student.guardianname || '',
      parentEmail: student.guardianemail || '',
      parentPhone: student.guardianphone || '',
      address: '', // Not in schema
      dateOfBirth: student.dob ? student.dob.toISOString().split('T')[0] : '',
      emergencyContact: student.guardianphone || '',
      medicalNotes: student.vacchist || '',
      isEnrolledInAfterSchool: student.isEnrolledInAfterSchool || false,
      // Calculate session totals from usersession (safe calculation)
      sessionsPurchased: student.usersession?.reduce((sum, session) => sum + (session.sessionsPurchased || 0), 0) || 0,
      sessionsAttended: student.usersession?.reduce((sum, session) => sum + (session.sessionsAttended || 0), 0) || 0,
      sessionsRemaining: student.usersession?.reduce((sum, session) => sum + (session.sessionsRemaining || 0), 0) || 0,
      // Use current date or session dates since user model doesn't have these fields
      createdAt: latestSession?.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: latestSession?.updatedAt?.toISOString() || new Date().toISOString(),
      // Format activities (handle empty array)
      activities: student.enrolledactivity?.map(enrollment => ({
        id: enrollment.id,
        name: enrollment.afterschoolactivity?.name || '',
        dayOfWeek: enrollment.afterschoolactivity?.dayOfWeek || '',
        startTime: enrollment.afterschoolactivity?.startTime?.toISOString() || '',
        enrolledDate: enrollment.enrollmentDate?.toISOString() || '',
      })) || [],
      // Format attendance history (handle empty array)
      attendanceHistory: student.attendance?.map(attendance => ({
        date: attendance.activitysession?.date?.toISOString().split('T')[0] || '',
        activityName: attendance.activitysession?.afterschoolactivity?.name || '',
        status: attendance.status || '',
        checkInTime: attendance.createdAt?.toISOString() || '',
      })) || [],
    };

    console.log(`[DEBUG] Returning formatted student data for ID: ${student.id}`);

    return c.json({
      success: true,
      data: formattedStudent,
    }, 200);

  } catch (error: any) {
    console.error('[ERROR] Error fetching student details:', error);
    console.error('[ERROR] Stack trace:', error.stack);
    
    return c.json({
      success: false,
      error: error?.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, 500);
  }
};

export const updateStudentController = async (c: Context): Promise<Response> => {
  try {
    const studentId = c.req.param('id');
    
    console.log(`[DEBUG] Updating student ID: ${studentId}`);
    
    if (!studentId) {
      return c.json({ 
        success: false, 
        error: 'Student ID is required' 
      }, 400);
    }
    
    const id = Number(studentId);
    if (isNaN(id)) {
      return c.json({ 
        success: false, 
        error: 'Invalid student ID format' 
      }, 400);
    }

    const body = await c.req.json();
    console.log(`[DEBUG] Update data:`, JSON.stringify(body, null, 2));
    
    // Check if student exists
    const existingStudent = await prisma.user.findUnique({
      where: { id },
      include: {
        usersession: true, // ✅ Include sessions to check original values
      }
    });

    if (!existingStudent) {
      return c.json({ 
        success: false, 
        error: 'Student not found' 
      }, 404);
    }

    // Map frontend fields to database fields
    const updateData: any = {};
    
    // Student basic info
    if (body.fname !== undefined) updateData.fname = body.fname;
    if (body.lname !== undefined) updateData.lname = body.lname;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.username !== undefined) updateData.username = body.username;
    if (body.grade !== undefined) updateData.grade = body.grade;
    
    // Guardian info
    if (body.parentName !== undefined) updateData.guardianname = body.parentName;
    if (body.parentEmail !== undefined) updateData.guardianemail = body.parentEmail;
    if (body.parentPhone !== undefined) updateData.guardianphone = body.parentPhone;
    if (body.emergencyContact !== undefined) updateData.guardianphone = body.emergencyContact;
    
    // Medical notes
    if (body.medicalNotes !== undefined) updateData.vacchist = body.medicalNotes;
    
    // Date of birth - handle empty string or invalid dates
    if (body.dateOfBirth !== undefined) {
      if (body.dateOfBirth && body.dateOfBirth.trim() !== '') {
        try {
          const date = new Date(body.dateOfBirth);
          if (!isNaN(date.getTime())) {
            updateData.dob = date;
          }
        } catch (e) {
          console.error('[ERROR] Error parsing date:', body.dateOfBirth, e);
        }
      } else {
        updateData.dob = null;
      }
    }

    console.log(`[DEBUG] User table update data:`, updateData);

    // Update the student basic info
    const updatedStudent = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        rfid: true,
        fname: true,
        lname: true,
        email: true,
        username: true,
        grade: true,
        guardianname: true,
        guardianemail: true,
        guardianphone: true,
        dob: true,
        vacchist: true,
        isEnrolledInAfterSchool: true,
      }
    });

    // ✅ NEW: Handle session updates if provided
    if (body.sessionsPurchased !== undefined) {
      console.log(`[DEBUG] Updating sessions. New purchased: ${body.sessionsPurchased}`);
      
      // Get all user sessions for this student
      const userSessions = existingStudent.usersession || [];
      
      if (userSessions.length > 0) {
        // Calculate the total original purchased across all sessions
        const totalOriginalPurchased = userSessions.reduce(
          (sum, session) => sum + session.sessionsPurchased, 
          0
        );
        
        // Calculate the difference
        const newTotalPurchased = Number(body.sessionsPurchased);
        const purchasedDifference = newTotalPurchased - totalOriginalPurchased;
        
        console.log(`[DEBUG] Session calculation:`);
        console.log(`  Total Original Purchased: ${totalOriginalPurchased}`);
        console.log(`  New Total Purchased: ${newTotalPurchased}`);
        console.log(`  Difference: ${purchasedDifference}`);
        
        // Update each session proportionally or update the first/main session
        // Option 1: Update the first session (simplest approach)
        const mainSession = userSessions[0];
        
        const newSessionsRemaining = mainSession.sessionsRemaining + purchasedDifference;
        
        console.log(`[DEBUG] Updating session ${mainSession.id}:`);
        console.log(`  Old: Purchased=${mainSession.sessionsPurchased}, Remaining=${mainSession.sessionsRemaining}`);
        console.log(`  New: Purchased=${newTotalPurchased}, Remaining=${newSessionsRemaining}`);
        
        await prisma.usersession.update({
          where: { id: mainSession.id },
          data: {
            sessionsPurchased: newTotalPurchased,
            sessionsRemaining: newSessionsRemaining,
            updatedAt: new Date(),
          }
        });
        
        console.log(`[DEBUG] Session updated successfully`);
      } else {
        console.log(`[DEBUG] No sessions found for student ${id}`);
      }
    }

    // Fetch the updated data including sessions
    const finalStudent = await prisma.user.findUnique({
      where: { id },
      include: {
        usersession: {
          select: {
            sessionsPurchased: true,
            sessionsAttended: true,
            sessionsRemaining: true,
          }
        }
      }
    });

    // Calculate session totals
    const sessionTotals = finalStudent?.usersession?.reduce(
      (acc, session) => ({
        purchased: acc.purchased + session.sessionsPurchased,
        attended: acc.attended + session.sessionsAttended,
        remaining: acc.remaining + session.sessionsRemaining,
      }),
      { purchased: 0, attended: 0, remaining: 0 }
    ) || { purchased: 0, attended: 0, remaining: 0 };

    // Format response
    const formattedStudent = {
      id: updatedStudent.id,
      rfid: updatedStudent.rfid?.toString() || '',
      fname: updatedStudent.fname || '',
      lname: updatedStudent.lname || '',
      email: updatedStudent.email || '',
      username: updatedStudent.username || '',
      grade: updatedStudent.grade || '',
      parentName: updatedStudent.guardianname || '',
      parentEmail: updatedStudent.guardianemail || '',
      parentPhone: updatedStudent.guardianphone || '',
      dateOfBirth: updatedStudent.dob ? updatedStudent.dob.toISOString().split('T')[0] : '',
      emergencyContact: updatedStudent.guardianphone || '',
      medicalNotes: updatedStudent.vacchist || '',
      isEnrolledInAfterSchool: updatedStudent.isEnrolledInAfterSchool || false,
      // ✅ Use the recalculated session totals
      sessionsPurchased: sessionTotals.purchased,
      sessionsAttended: sessionTotals.attended,
      sessionsRemaining: sessionTotals.remaining,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log(`[DEBUG] Student updated successfully: ${updatedStudent.id}`);

    return c.json({
      success: true,
      message: 'Student updated successfully',
      data: formattedStudent,
    }, 200);

  } catch (error: any) {
    console.error('[ERROR] Error updating student:', error);
    console.error('[ERROR] Stack trace:', error.stack);
    
    return c.json({
      success: false,
      error: error?.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, 500);
  }
};

export const getStudentSessionsController = async (c: Context): Promise<Response> => {
  try {
    const studentId = c.req.param('id');
    
    if (!studentId) {
      return c.json({ 
        success: false, 
        error: 'Student ID is required' 
      }, 400);
    }
    
    const id = Number(studentId);
    if (isNaN(id)) {
      return c.json({ 
        success: false, 
        error: 'Invalid student ID format' 
      }, 400);
    }

    // Fetch user sessions
    const userSessions = await prisma.usersession.findMany({
      where: { userId: id },
      include: {
        afterschoolactivity: {
          select: {
            name: true,
            dayOfWeek: true,
            startTime: true,
          }
        }
      }
    });

    // Calculate totals
    const totals = userSessions.reduce((acc, session) => ({
      purchased: acc.purchased + session.sessionsPurchased,
      attended: acc.attended + session.sessionsAttended,
      remaining: acc.remaining + session.sessionsRemaining,
    }), { purchased: 0, attended: 0, remaining: 0 });

    return c.json({
      success: true,
      data: {
        sessions: userSessions.map(session => ({
          id: session.id,
          activityName: session.afterschoolactivity.name,
          dayOfWeek: session.afterschoolactivity.dayOfWeek,
          startTime: session.afterschoolactivity.startTime,
          sessionsPurchased: session.sessionsPurchased,
          sessionsAttended: session.sessionsAttended,
          sessionsRemaining: session.sessionsRemaining,
        })),
        totals,
      }
    }, 200);

  } catch (error) {
    console.error('[ERROR] Error fetching student sessions:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

export const updateStudentSessionsController = async (c: Context): Promise<Response> => {
  try {
    const studentId = c.req.param('id');
    const body = await c.req.json();
    
    if (!studentId) {
      return c.json({ 
        success: false, 
        error: 'Student ID is required' 
      }, 400);
    }
    
    const id = Number(studentId);
    if (isNaN(id)) {
      return c.json({ 
        success: false, 
        error: 'Invalid student ID format' 
      }, 400);
    }

    const { activityId, sessionsPurchased, sessionsAttended } = body;
    
    if (!activityId) {
      return c.json({ 
        success: false, 
        error: 'Activity ID is required' 
      }, 400);
    }

    // Find the user session
    const userSession = await prisma.usersession.findFirst({
      where: {
        userId: id,
        activityId: Number(activityId)
      }
    });

    if (!userSession) {
      return c.json({ 
        success: false, 
        error: 'User session not found for this activity' 
      }, 404);
    }

    // Update the session
    const updatedSession = await prisma.usersession.update({
      where: { id: userSession.id },
      data: {
        sessionsPurchased: sessionsPurchased !== undefined ? Number(sessionsPurchased) : undefined,
        sessionsAttended: sessionsAttended !== undefined ? Number(sessionsAttended) : undefined,
        sessionsRemaining: sessionsPurchased !== undefined 
          ? Number(sessionsPurchased) - (sessionsAttended !== undefined ? Number(sessionsAttended) : userSession.sessionsAttended)
          : undefined,
        updatedAt: new Date(),
      }
    });

    return c.json({
      success: true,
      message: 'Student sessions updated successfully',
      data: updatedSession,
    }, 200);

  } catch (error) {
    console.error('[ERROR] Error updating student sessions:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

// Check RFID endpoint
export const checkRfidController = async (c: Context): Promise<Response> => {
  try {
    const rfid = c.req.param('rfid');
    
    if (!rfid) {
      return c.json({ success: false, error: 'RFID is required' }, 400);
    }
    
    // Validate RFID format
    if (!rfid.match(/^\d+$/)) {
      return c.json({ 
        success: false, 
        error: 'RFID must contain only numbers' 
      }, 400);
    }
    
    const rfidBigInt = BigInt(rfid);
    
    // Check if user with this RFID exists
    const user = await prisma.user.findFirst({
      where: { rfid: rfidBigInt },
      include: {
        coachedActivity: {
          select: {
            id: true,
            name: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            location: true,
          }
        }
      }
    });
    
    if (user) {
      const formattedUser = {
        ...user,
        rfid: user.rfid?.toString(),
        activities: user.coachedActivity ? [user.coachedActivity] : []
      };
      
      return c.json({ 
        success: true, 
        data: formattedUser,
        exists: true,
        userType: user.type || user.position || 'unknown'
      });
    }
    
    return c.json({ 
      success: true, 
      data: null,
      exists: false 
    });
    
  } catch (error) {
    console.error('[ERROR] Error checking RFID:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to check RFID' 
    }, 500);
  }
};
