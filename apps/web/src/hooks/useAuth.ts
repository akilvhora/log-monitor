import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import {
  login as apiLogin,
  logout as apiLogout,
  fetchCurrentUser,
  fetchUsers,
  createUser as apiCreateUser,
  updateUser as apiUpdateUser,
  deleteUser as apiDeleteUser,
} from "../lib/api";
import type { CreateUserInput, UpdateUserInput } from "@log-monitor/shared";

export function useCurrentUser() {
  const { setUser, setInitialized } = useAuthStore();

  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        const user = await fetchCurrentUser();
        setUser(user);
        return user;
      } catch {
        setUser(null);
        return null;
      } finally {
        setInitialized();
      }
    },
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: true,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      apiLogin(email, password),
    onSuccess: (user) => {
      setUser(user);
      queryClient.setQueryData(["auth", "me"], user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: apiLogout,
    onSettled: () => {
      setUser(null);
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });
}

// ---------------------------------------------------------------------------
// User management (admin+)
// ---------------------------------------------------------------------------

export function useUsers() {
  return useQuery({
    queryKey: ["auth", "users"],
    queryFn: fetchUsers,
    staleTime: 30_000,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserInput) => apiCreateUser(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth", "users"] }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) => apiUpdateUser(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth", "users"] }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDeleteUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth", "users"] }),
  });
}
