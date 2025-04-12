"use server";

import prisma from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function syncUser() {
  try {
    const { userId } = await auth();
    const user = await currentUser();
    if (!userId || !user) return;

    // Check if the user already exists in the database
    const existingUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });
    if (existingUser) {
      // User already exists, return the existing user
      return existingUser;
    }
    const dbUser = await prisma.user.create({
      data: {
        clerkId: userId,
        name: `${user.firstName || ""} ${user.lastName || ""}`,
        username:
          user.username ?? user.emailAddresses[0].emailAddress.split("@")[0],
        email: user.emailAddresses[0].emailAddress,
        image: user.imageUrl,
      },
    });
    return dbUser;
  } catch (error) {
    console.error("Error syncing user:", error);
  }
}

export async function getUserByClerkId(clerkId: string) {
  return prisma.user.findUnique({
    where: {
      clerkId,
    },
    include: {
      _count: {
        select: {
          followers: true,
          following: true,
          posts: true,
        },
      },
    },
  });
}

// This function is used to get the user ID from the Clerk ID
// It is used in the getUserById function to get the user ID from the database
// and return it to the client
export async function getDbUserId() {
  // Get the current user from Clerk
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  // Get the user from the database using the Clerk ID
  const user = await getUserByClerkId(clerkId);
  if (!user) throw new Error("User not found");

  return user.id;
}

export async function getRandomUsers() {
  try {
    const userId = await getDbUserId();
    if (!userId) return [];
    // get 3 random exclude ourselves & users that we already follow
    const randomUsers = await prisma.user.findMany({
      where: {
        AND: [
          { NOT: { id: userId } },
          { NOT: { followers: { some: { followerId: userId } } } },
        ],
      },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        _count: {
          select: {
            followers: true,
          },
        },
      },
      take: 3,
    });
    return randomUsers;
  } catch (error) {
    console.error("Error getting random users:", error);
    return [];
  }
}

export async function toggleFollow(targeUserId: string) {
  try {
    const userId = await getDbUserId();
    if (!userId) return;
    if (userId === targeUserId) throw new Error("You cannot follow yourself");

    const existingFollow = await prisma.follows.findUnique({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId: targeUserId,
        },
      },
    });
    if (existingFollow) {
      // unfollow the user
      await prisma.follows.delete({
        where: {
          followerId_followingId: {
            followerId: userId,
            followingId: targeUserId,
          },
        },
      });
    } else {
      // follow the user
      await prisma.$transaction([
        prisma.follows.create({
          data: {
            followerId: userId,
            followingId: targeUserId,
          },
        }),
        prisma.notification.create({
          data: {
            type: "FOLLOW",
            userId: targeUserId,
            creatorId: userId,
          },
        }),
      ]);
    }
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error toggling follow:", error);
    return { success: false, error: "Error toggling follow" };
  }
}
