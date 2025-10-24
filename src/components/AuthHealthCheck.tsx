import { useAuth } from "@/hooks/useAuth";

export const AuthHealthCheck = () => {
  const { user, isLoggedIn } = useAuth();
  console.log("Auth Health Check:", { user, isLoggedIn });
  return <div>Auth Status: {isLoggedIn ? "Logged In" : "Not Logged In"}</div>;
};
