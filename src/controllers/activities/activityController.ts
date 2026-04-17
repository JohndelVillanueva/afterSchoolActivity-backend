import { type Context } from 'hono';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAllActivitiesController = async (c: Context): Promise<Response> => {
  try {
    const activities = await prisma.afterschoolactivity.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        location: true,
        coachName: true,
        photo: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return c.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    console.error('[ERROR] Error fetching activities:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

export const getActivityByIdController = async (c: Context): Promise<Response> => {
  try {
    const id = Number(c.req.param('id'));
    
    if (isNaN(id)) {
      return c.json({
        success: false,
        error: 'Invalid activity ID',
      }, 400);
    }

    const activity = await prisma.afterschoolactivity.findUnique({
      where: { id },
      include: {
        enrolledactivity: {
          include: {
            user: {
              select: {
                id: true,
                fname: true,
                lname: true,
                email: true,
                rfid: true,
              },
            },
          },
        },
        activitysession: {
          orderBy: {
            date: 'desc',
          },
          take: 10,
        },
      },
    });

    if (!activity) {
      return c.json({
        success: false,
        error: 'Activity not found',
      }, 404);
    }

    const activityWithSerializableData = {
      ...activity,
      enrolledactivity: activity.enrolledactivity.map(enrollment => ({
        ...enrollment,
        user: {
          ...enrollment.user,
          rfid: enrollment.user.rfid?.toString(),
        },
      })),
    };

    return c.json({
      success: true,
      data: activityWithSerializableData,
    });
  } catch (error) {
    console.error('[ERROR] Error fetching activity:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

// export const createActivityController = async (c: Context): Promise<Response> => {
//   try {
//     const body = await c.req.json();
//     const {
//       name,
//       description = '',
//       dayOfWeek,
//       startTime,
//       endTime,
//       location = '',
//       coachName = '',
//       photo = '',
//       rate = 0,
//     } = body;

//     if (!name || !dayOfWeek || !startTime || !endTime) {
//       return c.json({
//         success: false,
//         error: 'Missing required fields: name, dayOfWeek, startTime, endTime',
//       }, 400);
//     }

//     const activity = await prisma.afterschoolactivity.create({
//       data: {
//         name,
//         description,
//         dayOfWeek,
//         startTime: new Date(startTime),
//         endTime: new Date(endTime),
//         location,
//         coachName,
//         photo,
//         rate,
//       },
//     });

//     const activityWithStringRate = {
//       ...activity,
//       rate: activity.rate.toString(),
//       startTime: activity.startTime.toISOString(),
//       endTime: activity.endTime.toISOString(),
//     };

//     return c.json({
//       success: true,
//       data: activityWithStringRate,
//     }, 201);
//   } catch (error) {
//     console.error('[ERROR] Error creating activity:', error);
//     return c.json({
//       success: false,
//       error: error instanceof Error ? error.message : 'Internal server error',
//     }, 500);
//   }
// };

export const updateActivityController = async (c: Context): Promise<Response> => {
  try {
    const id = Number(c.req.param('id'));
    const body = await c.req.json();

    if (isNaN(id)) {
      return c.json({
        success: false,
        error: 'Invalid activity ID',
      }, 400);
    }

    const updateData: any = {};
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.coachName !== undefined) updateData.coachName = body.coachName;
    if (body.photo !== undefined) updateData.photo = body.photo;

    const activity = await prisma.afterschoolactivity.update({
      where: { id },
      data: updateData,
    });

    return c.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error('[ERROR] Error updating activity:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};

export const deleteActivityController = async (c: Context): Promise<Response> => {
  try {
    const id = Number(c.req.param('id'));

    if (isNaN(id)) {
      return c.json({
        success: false,
        error: 'Invalid activity ID',
      }, 400);
    }

    await prisma.afterschoolactivity.delete({
      where: { id },
    });

    return c.json({
      success: true,
      message: 'Activity deleted successfully',
    });
  } catch (error) {
    console.error('[ERROR] Error deleting activity:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
};