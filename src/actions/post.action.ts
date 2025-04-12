"use server";

import prisma from "@/lib/prisma";
import { getUserById } from "./user.action";
import { revalidatePath } from "next/cache";

export async function createPost(content: string, image: string) {
  try {
    const userId = await getUserById();
    const post = await prisma.post.create({
      data: {
        content,
        image,
        authorId: userId,
      },
    });
    revalidatePath("/");
    return { success: true, post };
  } catch (error) {
    console.error("Error creating post:", error);
  }
}
