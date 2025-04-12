"use client";

import { Post } from "@prisma/client";

function PostCard({ post, dbUserId }: { post: Post; dbUserId: string | null }) {
  return <div>PostCard</div>;
}

export default PostCard;
