import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deletePost as deletePostFn } from "@/actions/post"; // adjust path

export const useDeletePost = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ postId, userId }) => {
            return await deletePostFn(postId, userId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['posts','all'] }); // Adjust your query key
        },
    });
};
