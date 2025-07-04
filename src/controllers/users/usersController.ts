import { type Context } from 'hono';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAllUsersController = async (c: Context): Promise<Response> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        rfid: true,
        fname: true,
        mname: true,
        lname: true,
        position: true, // user role
        email: true,
        isEnrolledInAfterSchool: true,
      },
    });

    // Convert BigInt rfid to string
    const usersWithStringRfid = users.map(user => ({
      ...user,
      rfid: user.rfid?.toString(),
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

export const registerStudentController = async (c: Context): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { rfid, activityId } = body;

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

    // Create enrollment record
    const enrollment = await prisma.enrolledactivity.create({
      data: {
        userId: user.id,
        activityId: Number(activityId),
      },
    });

    // Update user enrollment status
    await prisma.user.update({
      where: { id: user.id },
      data: { isEnrolledInAfterSchool: true },
    });

    return c.json({
      success: true,
      data: enrollment,
    }, 201);
  } catch (error) {
    console.error('[ERROR] Error registering student:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

