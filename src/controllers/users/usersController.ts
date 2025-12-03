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
        usersession: {  // Add this ✅
          select: {
            sessionsPurchased: true,
            sessionsAttended: true,
            sessionsRemaining: true,
          }
        }
      },
    });

    // Convert BigInt rfid to string and flatten session data
    const usersWithStringRfid = users.map(user => ({
      ...user,
      rfid: user.rfid?.toString(),
      // Get the first session data (or sum if multiple activities)
      sessionsPurchased: user.usersession[0]?.sessionsPurchased || 0,
      sessionsAttended: user.usersession[0]?.sessionsAttended || 0,
      sessionsRemaining: user.usersession[0]?.sessionsRemaining || 0,
    }));

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
    const { fname, lname, email, rfid, gender = '', mobile = '' } = body;
    
    console.log('[DEBUG] Create coach request body:', body);
    
    if (!fname || !lname || !email || !rfid) {
      console.log('[ERROR] Missing required fields:', { fname, lname, email, rfid });
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }
    
    // Check if coach with same RFID or email exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { rfid: BigInt(rfid) },
          { email: email }
        ]
      }
    });
    
    if (existing) {
      return c.json({ success: false, error: 'Coach with this RFID or email already exists' }, 400);
    }
    
    const coach = await prisma.user.create({
      data: {
        rfid: BigInt(rfid),
        fname,
        mname: '',
        lname,
        type: 'coach',
        gender,
        position: 'coach',
        grade: '',
        section: '',
        dob: null,
        email,
        mobile,
        vacchist: '',
        photo: '',
        manager: '',
        isactive: 1,
        is_situation: '',
        username: email,
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
        isEnrolledInAfterSchool: false,
      }
    });
    
    // Convert BigInt to string before returning
    const coachWithStringRfid = {
      ...coach,
      rfid: coach.rfid?.toString(),
    };
    
    return c.json({ success: true, data: coachWithStringRfid }, 201);
  } catch (error) {
    console.error('[ERROR] Error creating coach:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }, 500);
  }
};

export const getAllStudentsController = async (c: Context): Promise<Response> => {
  try {
    const students = await prisma.user.findMany({
      where: {
        position: 'student',
        isEnrolledInAfterSchool: true,
      },
      select: {
        id: true,
        rfid: true,
        fname: true,
        mname: true,
        lname: true,
        position: true,
        email: true,
        isEnrolledInAfterSchool: true,
      },
    });

    const result = students.map(student => ({
      ...student,
      rfid: student.rfid?.toString(),
    }));

    return c.json({ success: true, data: result });
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
    const coaches = await prisma.user.findMany({
      where: {
        position: 'coach',
      },
      select: {
        id: true,
        rfid: true,
        fname: true,
        mname: true,
        lname: true,
        position: true,
        email: true,
        isEnrolledInAfterSchool: true,
      },
    });

    const result = coaches.map(coach => ({
      ...coach,
      rfid: coach.rfid?.toString(),
    }));

    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('[ERROR] Error fetching coaches:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
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
      data: { isEnrolledInAfterSchool: true },
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
      
      // Check if they just need to be enrolled in after-school
      if (!existing.isEnrolledInAfterSchool && activityId) {
        console.log('[DEBUG] Enrolling existing student in after-school program');
        
        // Update the user's enrollment status
        await prisma.user.update({
          where: { id: existing.id },
          data: { isEnrolledInAfterSchool: true },
        });
        
        // Check if enrollment record already exists
        let enrollment = await prisma.enrolledactivity.findUnique({
          where: {
            userId_activityId: {
              userId: existing.id,
              activityId: Number(activityId),
            }
          },
        });
        
        // Create enrollment record only if it doesn't exist
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
          console.log('[DEBUG] Activity session created:', activitySession.id);
        } else {
          console.log('[DEBUG] Activity session found:', activitySession.id);
        }
        
        // REMOVED: Automatic attendance creation ❌
        // We only create enrollment and session, not attendance

        // Create or update user session record
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
              sessionsAttended: 0,  // Changed from 1 to 0 ✅
              sessionsRemaining: Number(sessionsPurchased),  // Changed: no -1 ✅
            },
          });
          console.log('[DEBUG] User session created:', userSession.id);
        } else {
          // Update existing session
          userSession = await prisma.usersession.update({
            where: { id: userSession.id },
            data: {
              sessionsPurchased: Number(sessionsPurchased),
              sessionsRemaining: Number(sessionsPurchased) - userSession.sessionsAttended,  // Recalculate based on existing attended ✅
              updatedAt: new Date(),
            },
          });
          console.log('[DEBUG] User session updated:', userSession.id);
        }
        
        const studentWithStringRfid = {
          ...existing,
          rfid: existing.rfid?.toString(),
          isEnrolledInAfterSchool: true,
        };
        
        return c.json({ 
          success: true, 
          data: studentWithStringRfid,
          enrollment,
          session: activitySession,
          userSession,
          userExists: true,
          message: 'Existing student enrolled in after-school program successfully'
        }, 200);
      }
      
      // If they're already enrolled, return error
      return c.json({ 
        success: false, 
        error: `${existing.fname} ${existing.lname} (RFID: ${rfid}) is already enrolled in the after-school program.`,
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
        isEnrolledInAfterSchool: activityId ? true : false,
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
      
      // REMOVED: Automatic attendance creation for new students ❌
      // Attendance will be marked separately when student actually attends

      // Create user session for new student
      userSession = await prisma.usersession.create({
        data: {
          userId: student.id,
          activityId: Number(activityId),
          sessionId: activitySession.id,
          sessionsPurchased: Number(sessionsPurchased),
          sessionsAttended: 0,  // Changed from 1 to 0 ✅
          sessionsRemaining: Number(sessionsPurchased),  // Changed: no -1 ✅
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

// --- NEW CONTROLLER: Fetches students enrolled in a specific activity ---
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

    // 1. Find all `enrolledactivity` records matching the given activityId
    const enrolledRecords = await prisma.enrolledactivity.findMany({
      where: { activityId: id },
      select: { userId: true },
    });

    const userIds = enrolledRecords.map(record => record.userId);

    if (userIds.length === 0) {
        return c.json({ success: true, data: [] }); // No students found
    }

    // 2. Fetch the actual user details for those user IDs
    const students = await prisma.user.findMany({
      where: {
        id: { in: userIds }, // Filter by the IDs found above
        position: 'student', // Safety check: ensure they are students
        isEnrolledInAfterSchool: true, // Only include students actively enrolled in after-school program
      },
      select: {
        id: true,
        rfid: true,
        fname: true,
        mname: true,
        lname: true,
        position: true,
        email: true,
        isEnrolledInAfterSchool: true,
      },
    });

    // 3. Convert BigInt rfid to string
    const result = students.map(student => ({
      ...student,
      rfid: student.rfid?.toString(),
    }));

    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('[ERROR] Error fetching students by activity:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
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
      data: { isEnrolledInAfterSchool: true },
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

// Optional: Verify token middleware
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

// Optional: Get current user info (protected route)
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

// Optional: Logout controller (if you want to implement token blacklisting)
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
