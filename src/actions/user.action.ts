"use server";

import prisma from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";

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
export async function getUserById() {
  // Get the current user from Clerk
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("User not authenticated");

  // Get the user from the database using the Clerk ID
  const user = await getUserByClerkId(clerkId);
  if (!user) throw new Error("User not found");

  return user.id;
}
